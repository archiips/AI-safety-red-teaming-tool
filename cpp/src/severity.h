#pragma once
#include <string>
#include <vector>
#include <map>
#include <memory>

// Declared in unicode_norm.cpp — apply before AC matching
std::string normalize_text(const std::string& input);

struct ScoreResult {
    double severity;
    std::vector<std::string> matched_rules;
    std::map<std::string, double> category_scores;

    // pybind11 needs these as dicts — convert in bindings or expose fields directly
    std::map<std::string, double> to_dict() const;
};

// Forward declaration — actual AC state lives in severity.cpp
struct AhoCorasickState;

struct Rule {
    std::string id;
    std::string category;
    std::string keyword;
    double weight;
    std::string description;
};

class PolicyEngine {
public:
    explicit PolicyEngine(const std::string &rules_json_path);
    ~PolicyEngine();

    // Returns a dict-compatible struct; GIL released by pybind11 call_guard
    ScoreResult score(const std::string &text, const std::string &category = "") const;

    void reload_rules(const std::string &rules_json_path);

private:
    void load_and_build(const std::string &rules_json_path);

    std::vector<Rule> rules_;
    std::unique_ptr<AhoCorasickState> ac_state_;
};
