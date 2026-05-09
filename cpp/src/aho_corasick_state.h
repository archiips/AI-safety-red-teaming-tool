#pragma once
#include <string>
#include <vector>
#include <unordered_map>
#include "../include/aho_corasick.hpp"

// Full definition of the pimpl type used by PolicyEngine.
// Included by severity.cpp (caller) and aho_corasick.cpp (implementer).
struct AhoCorasickState {
    aho_corasick::trie ac;
    std::unordered_map<std::string, std::string> keyword_to_rule; // lc_keyword → rule_id

    // Insert a lowercased keyword and its owning rule_id into the trie.
    void insert(const std::string& lc_keyword, const std::string& rule_id);

    // Trigger failure-state construction now (thread-safe: call after all inserts,
    // before the first search). Without this the trie builds lazily on the first
    // parse_text call — which is a write inside what should be a read-only path.
    void build();

    // Search text; return deduplicated rule_ids for every keyword that matched.
    // Non-const: cjgdev trie::parse_text() is non-const (lazy failure-state build).
    // Calling through unique_ptr from a const PolicyEngine::score() is fine —
    // unique_ptr::operator->() const returns T*, not const T*.
    std::vector<std::string> search(const std::string& text);
};
