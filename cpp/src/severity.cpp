#include "severity.h"
#include "../include/aho_corasick.hpp"
#include <re2/re2.h>
#include <fstream>
#include <stdexcept>
#include <algorithm>
#include <cctype>

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

// ---------- AhoCorasickState holds the built trie + keyword→rule_id map ----------

struct AhoCorasickState {
    aho_corasick::trie ac;
    // maps lowercase keyword → rule_id (for result lookup after match)
    std::unordered_map<std::string, std::string> keyword_to_rule;
};

// ---------- ScoreResult helpers ----------

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

        // Lowercase keyword for case-insensitive matching
        std::string lc = r.keyword;
        std::transform(lc.begin(), lc.end(), lc.begin(), ::tolower);

        rules_.push_back(r);
        ac_state_->keyword_to_rule[lc] = r.id;
        ac_state_->ac.insert(lc);
    }

    ac_state_->ac.build(); // build failure links once
}

PolicyEngine::PolicyEngine(const std::string& rules_json_path)
    : ac_state_(std::make_unique<AhoCorasickState>())
{
    load_and_build(rules_json_path);
}

PolicyEngine::~PolicyEngine() = default;

void PolicyEngine::reload_rules(const std::string& rules_json_path) {
    load_and_build(rules_json_path);
}

ScoreResult PolicyEngine::score(const std::string& text,
                                const std::string& category) const {
    // Normalize: lowercase + leetspeak/homoglyph/obfuscation (defined in unicode_norm.cpp)
    std::string normalized = normalize_text(text);
    std::transform(normalized.begin(), normalized.end(), normalized.begin(), ::tolower);

    ScoreResult result;
    result.severity = 0.0;

    // RE2: detect hyphenated/dotted obfuscation and also strip separators
    // (normalize_text already handles this, but we add a RE2 fallback for edge cases)
    static const re2::RE2 sep_pattern(R"(([a-z])[-. ]([a-z]))");
    std::string de_sep = normalized;
    std::string prev;
    do {
        prev = de_sep;
        re2::RE2::GlobalReplace(&de_sep, sep_pattern, R"(\1\2)");
    } while (de_sep != prev);

    // Run AC on both normalized and de-obfuscated versions to catch all variants
    auto run_ac = [&](const std::string& input) {
        auto hits = ac_state_->ac.parse_text(input);
        for (auto& hit : hits) {
            auto it = ac_state_->keyword_to_rule.find(hit.keyword);
            if (it == ac_state_->keyword_to_rule.end()) continue;

            const std::string& rule_id = it->second;

            // Find the rule
            const Rule* rule = nullptr;
            for (auto& r : rules_) {
                if (r.id == rule_id) { rule = &r; break; }
            }
            if (!rule) continue;
            if (!category.empty() && rule->category != category) continue;

            // Avoid duplicate matches (same rule_id already recorded)
            bool already = false;
            for (auto& m : result.matched_rules)
                if (m == rule_id) { already = true; break; }
            if (already) continue;

            result.matched_rules.push_back(rule_id);
            result.category_scores[rule->category] += rule->weight;
        }
    };

    run_ac(normalized);
    if (de_sep != normalized) run_ac(de_sep);

    // Clamp to 0–7
    double total = 0.0;
    for (auto& [cat, w] : result.category_scores) total += w;
    result.severity = std::min(total, 7.0);

    return result;
}
