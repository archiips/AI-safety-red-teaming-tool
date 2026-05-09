#pragma once
#include <string>
#include <vector>
#include <map>
#include <memory>
#include <shared_mutex>

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

// Logistic regression severity head — loaded from severity_weights.json
struct SeverityHead {
    std::vector<std::string> categories; // feature order
    std::vector<double> coef;            // one per category
    double intercept;
    bool loaded;

    SeverityHead() : intercept(0.0), loaded(false) {}

    // sigmoid(coef · category_scores + intercept) × 7
    double predict(const std::map<std::string, double>& cat_scores) const;
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
    void try_load_severity_head(const std::string &rules_json_path);

    // rw_mutex_ guards rules_, ac_state_, and head_ for concurrent reload safety.
    // score() holds a shared_lock (readers); reload_rules() holds a unique_lock.
    mutable std::shared_mutex rw_mutex_;
    std::vector<Rule> rules_;
    std::unique_ptr<AhoCorasickState> ac_state_;
    SeverityHead head_;
};
