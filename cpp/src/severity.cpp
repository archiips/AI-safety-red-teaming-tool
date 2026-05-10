#include "severity.h"
#include "aho_corasick_state.h"
#include <re2/re2.h>
#include <unordered_map>
#include <unordered_set>
#include <fstream>
#include <stdexcept>
#include <algorithm>
#include <cctype>
#include <cmath>
#include <filesystem>
#include <mutex>
#include <shared_mutex>

// ---------- Minimal JSON helpers ----------

static std::string extract_string(const std::string& json, const std::string& key) {
    auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return "";
    pos = json.find(':', pos) + 1;
    while (pos < json.size() && (json[pos] == ' ' || json[pos] == '\t')) ++pos;
    if (json[pos] == '"') {
        ++pos;
        auto end = json.find('"', pos);
        return json.substr(pos, end - pos);
    }
    auto end = json.find_first_of(",}", pos);
    return json.substr(pos, end - pos);
}

static std::vector<std::string> split_objects(const std::string& array_json) {
    std::vector<std::string> objects;
    int depth = 0;
    std::size_t start = std::string::npos;
    for (std::size_t i = 0; i < array_json.size(); ++i) {
        if (array_json[i] == '{') {
            if (depth == 0) start = i;
            ++depth;
        } else if (array_json[i] == '}') {
            --depth;
            if (depth == 0 && start != std::string::npos) {
                objects.push_back(array_json.substr(start, i - start + 1));
                start = std::string::npos;
            }
        }
    }
    return objects;
}

// ---------- JSON array helpers (for severity_weights.json) ----------

static std::vector<std::string> parse_string_array(const std::string& json,
                                                    const std::string& key) {
    auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return {};
    pos = json.find('[', pos);
    if (pos == std::string::npos) return {};
    std::vector<std::string> result;
    ++pos;
    while (pos < json.size()) {
        while (pos < json.size() && json[pos] != '"' && json[pos] != ']') ++pos;
        if (pos >= json.size() || json[pos] == ']') break;
        ++pos;
        auto end = json.find('"', pos);
        if (end == std::string::npos) break;
        result.push_back(json.substr(pos, end - pos));
        pos = end + 1;
    }
    return result;
}

static std::vector<double> parse_double_array(const std::string& json,
                                              const std::string& key) {
    auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return {};
    pos = json.find('[', pos);
    if (pos == std::string::npos) return {};
    std::vector<double> result;
    ++pos;
    while (pos < json.size()) {
        while (pos < json.size() &&
               json[pos] != ']' && json[pos] != '-' && !std::isdigit(json[pos])) ++pos;
        if (pos >= json.size() || json[pos] == ']') break;
        auto end = json.find_first_of(",]", pos);
        std::string tok = json.substr(pos, end - pos);
        try { result.push_back(std::stod(tok)); } catch (...) {}
        pos = end;
    }
    return result;
}

// ---------- SeverityHead ----------

double SeverityHead::predict(const std::map<std::string, double>& cat_scores) const {
    double z = intercept;
    for (std::size_t i = 0; i < categories.size() && i < coef.size(); ++i) {
        auto it = cat_scores.find(categories[i]);
        if (it != cat_scores.end())
            z += coef[i] * it->second;
    }
    return 7.0 / (1.0 + std::exp(-z));  // sigmoid × 7
}

// ---------- ScoreResult helper ----------

std::map<std::string, double> ScoreResult::to_dict() const {
    return category_scores;
}

// ---------- PolicyEngine implementation ----------

void PolicyEngine::load_and_build(const std::string& rules_json_path) {
    std::ifstream f(rules_json_path);
    if (!f.is_open())
        throw std::runtime_error("Cannot open rules file: " + rules_json_path);

    std::string json((std::istreambuf_iterator<char>(f)),
                      std::istreambuf_iterator<char>());

    auto arr_start = json.find('[');
    auto arr_end   = json.rfind(']');
    if (arr_start == std::string::npos || arr_end == std::string::npos)
        throw std::runtime_error("Invalid rules.json: no array found");

    auto objs = split_objects(json.substr(arr_start, arr_end - arr_start + 1));

    rules_.clear();
    ac_state_ = std::make_unique<AhoCorasickState>();

    for (auto& obj : objs) {
        Rule r;
        r.id          = extract_string(obj, "id");
        r.category    = extract_string(obj, "category");
        r.keyword     = extract_string(obj, "keyword");
        r.description = extract_string(obj, "description");
        auto w_str    = extract_string(obj, "weight");
        r.weight      = w_str.empty() ? 1.0 : std::stod(w_str);

        if (r.id.empty() || r.keyword.empty()) continue;

        std::string lc = r.keyword;
        std::transform(lc.begin(), lc.end(), lc.begin(), ::tolower);

        rules_.push_back(r);
        ac_state_->insert(lc, r.id);
    }

    ac_state_->build(); // force failure-state construction before first search
}

// Derive severity_weights.json path from rules_json_path (same directory)
void PolicyEngine::try_load_severity_head(const std::string& rules_json_path) {
    namespace fs = std::filesystem;
    fs::path weights_path = fs::path(rules_json_path).parent_path() / "severity_weights.json";
    if (!fs::exists(weights_path)) return;

    std::ifstream wf(weights_path);
    if (!wf.is_open()) return;
    std::string wjson((std::istreambuf_iterator<char>(wf)),
                       std::istreambuf_iterator<char>());

    head_.categories = parse_string_array(wjson, "categories");
    head_.coef       = parse_double_array(wjson, "coef");

    auto ipos = wjson.find("\"intercept\"");
    if (ipos != std::string::npos) {
        ipos = wjson.find(':', ipos) + 1;
        while (ipos < wjson.size() && (wjson[ipos] == ' ' || wjson[ipos] == '\t')) ++ipos;
        auto iend = wjson.find_first_of(",}", ipos);
        try { head_.intercept = std::stod(wjson.substr(ipos, iend - ipos)); }
        catch (...) { head_.intercept = 0.0; }
    }

    head_.loaded = !head_.categories.empty() && head_.coef.size() == head_.categories.size();
}

PolicyEngine::PolicyEngine(const std::string& rules_json_path)
    : ac_state_(std::make_unique<AhoCorasickState>())
{
    load_and_build(rules_json_path);
    try_load_severity_head(rules_json_path);
}

PolicyEngine::~PolicyEngine() = default;

void PolicyEngine::reload_rules(const std::string& rules_json_path) {
    // Build new state outside the lock (expensive work done without blocking readers)
    std::vector<Rule> new_rules;
    std::unique_ptr<AhoCorasickState> new_ac;
    SeverityHead new_head;

    // Temporarily use a fresh engine to build state, then steal its internals
    {
        PolicyEngine tmp(rules_json_path);
        std::unique_lock<std::shared_mutex> lock(rw_mutex_);
        rules_    = std::move(tmp.rules_);
        ac_state_ = std::move(tmp.ac_state_);
        head_     = std::move(tmp.head_);
    }
}

ScoreResult PolicyEngine::score(const std::string& text,
                                const std::string& category) const {
    std::shared_lock<std::shared_mutex> lock(rw_mutex_);

    // Normalize: homoglyph substitution + leetspeak + base64 decode
    std::string normalized = normalize_text(text);
    std::transform(normalized.begin(), normalized.end(), normalized.begin(), ::tolower);

    // RE2: strip separator chars between single letters to de-obfuscate h-u-r-t → hurt.
    // Compiled once; loop until stable (handles k.i.l.l → kil.l → kill).
    static const re2::RE2 sep_pattern(R"(([a-z])[-. ]([a-z]))");
    std::string de_sep = normalized;
    {
        std::string prev;
        do {
            prev = de_sep;
            re2::RE2::GlobalReplace(&de_sep, sep_pattern, R"(\1\2)");
        } while (de_sep != prev);
    }

    // Collect matched rule IDs from both search passes, deduplicating across them.
    std::unordered_set<std::string> seen;
    ScoreResult result;
    result.severity = 0.0;

    auto apply_matches = [&](const std::vector<std::string>& rule_ids) {
        for (auto& rule_id : rule_ids) {
            if (!seen.insert(rule_id).second) continue; // already recorded

            const Rule* rule = nullptr;
            for (auto& r : rules_)
                if (r.id == rule_id) { rule = &r; break; }
            if (!rule) continue;
            if (!category.empty() && rule->category != category) continue;

            result.matched_rules.push_back(rule_id);
            result.category_scores[rule->category] += rule->weight;
        }
    };

    apply_matches(ac_state_->search(normalized));
    if (de_sep != normalized)
        apply_matches(ac_state_->search(de_sep));

    // No rules matched → definitely not harmful; skip the severity head
    if (result.matched_rules.empty()) {
        result.severity = 0.0;
        return result;
    }

    // Severity: use logistic head if weights were loaded, else clamp raw sum
    if (head_.loaded) {
        result.severity = head_.predict(result.category_scores);
    } else {
        double total = 0.0;
        for (auto& [cat, w] : result.category_scores) total += w;
        result.severity = std::min(total, 7.0);
    }

    return result;
}
