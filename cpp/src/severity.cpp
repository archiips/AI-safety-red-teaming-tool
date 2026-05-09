#include "severity.h"
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <algorithm>
#include <cctype>

// Minimal JSON parser for rules.json — no external JSON lib required
// Format expected: {"rules": [{"id":..., "category":..., "keyword":..., "weight":..., "description":...}]}

// ---------- AhoCorasickState stub (replaced in Task 2.2) ----------
struct AhoCorasickState {
    // Placeholder — contains keyword→rule_id map for linear scan fallback
    std::vector<std::pair<std::string, std::string>> patterns; // (keyword, rule_id)
};

// ---------- ScoreResult helpers ----------
std::map<std::string, double> ScoreResult::to_dict() const {
    return category_scores;
}

// ---------- Tiny JSON field extractor ----------
static std::string extract_string(const std::string &json, const std::string &key) {
    auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return "";
    pos = json.find(':', pos) + 1;
    while (pos < json.size() && (json[pos] == ' ' || json[pos] == '\t')) ++pos;
    if (json[pos] == '"') {
        ++pos;
        auto end = json.find('"', pos);
        return json.substr(pos, end - pos);
    }
    // numeric
    auto end = json.find_first_of(",}", pos);
    return json.substr(pos, end - pos);
}

static std::vector<std::string> split_objects(const std::string &array_json) {
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

// ---------- PolicyEngine implementation ----------

void PolicyEngine::load_and_build(const std::string &rules_json_path) {
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

    for (auto &obj : objs) {
        Rule r;
        r.id          = extract_string(obj, "id");
        r.category    = extract_string(obj, "category");
        r.keyword     = extract_string(obj, "keyword");
        r.description = extract_string(obj, "description");
        auto w_str    = extract_string(obj, "weight");
        r.weight      = w_str.empty() ? 1.0 : std::stod(w_str);
        if (!r.id.empty() && !r.keyword.empty()) {
            rules_.push_back(r);
            // lowercase keyword for case-insensitive matching
            std::string lc = r.keyword;
            std::transform(lc.begin(), lc.end(), lc.begin(), ::tolower);
            ac_state_->patterns.emplace_back(lc, r.id);
        }
    }
}

PolicyEngine::PolicyEngine(const std::string &rules_json_path)
    : ac_state_(std::make_unique<AhoCorasickState>())
{
    load_and_build(rules_json_path);
}

PolicyEngine::~PolicyEngine() = default;

void PolicyEngine::reload_rules(const std::string &rules_json_path) {
    load_and_build(rules_json_path);
}

ScoreResult PolicyEngine::score(const std::string &text,
                                const std::string &category) const {
    // Lowercase input for case-insensitive matching
    std::string lc_text = text;
    std::transform(lc_text.begin(), lc_text.end(), lc_text.begin(), ::tolower);

    ScoreResult result;
    result.severity = 0.0;

    for (auto &[keyword, rule_id] : ac_state_->patterns) {
        if (lc_text.find(keyword) == std::string::npos) continue;

        // Find the rule
        for (auto &r : rules_) {
            if (r.id != rule_id) continue;
            if (!category.empty() && r.category != category) continue;
            result.matched_rules.push_back(r.id);
            result.category_scores[r.category] += r.weight;
            break;
        }
    }

    // Sum all category weights into severity, clamp to 0-7
    double total = 0.0;
    for (auto &[cat, w] : result.category_scores) total += w;
    result.severity = std::min(total, 7.0);

    return result;
}
