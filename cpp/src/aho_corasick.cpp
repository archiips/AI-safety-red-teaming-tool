#include "aho_corasick_state.h"
#include <unordered_set>

void AhoCorasickState::insert(const std::string& lc_keyword, const std::string& rule_id) {
    keyword_to_rule[lc_keyword] = rule_id;
    ac.insert(lc_keyword);
}

void AhoCorasickState::build() {
    // cjgdev trie builds failure states lazily inside parse_text().
    // Calling parse_text("") here forces that one-time write to happen
    // before any concurrent searches begin.
    ac.parse_text("");
}

std::vector<std::string> AhoCorasickState::search(const std::string& text) {
    std::vector<std::string> matched_ids;
    std::unordered_set<std::string> seen;

    for (auto& hit : ac.parse_text(text)) {
        auto it = keyword_to_rule.find(hit.get_keyword());
        if (it == keyword_to_rule.end()) continue;
        if (seen.insert(it->second).second) // .second == true → newly inserted
            matched_ids.push_back(it->second);
    }
    return matched_ids;
}
