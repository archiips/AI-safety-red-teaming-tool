#pragma once
#include <string>
#include <vector>
#include <queue>
#include <unordered_map>

// Classic Aho-Corasick multi-pattern search.
// Usage: insert patterns, call build(), then parse_text().
// All matching is exact (caller is responsible for lowercasing).

namespace aho_corasick {

struct emit {
    std::string keyword;
    size_t start; // byte index of first char
    size_t end;   // byte index of last char (inclusive)
};

class trie {
    struct node {
        std::unordered_map<char, int> next;
        int fail = 0;
        std::vector<std::string> output; // patterns ending here (incl. via suffix links)
    };

    std::vector<node> nodes_;

public:
    trie() { nodes_.emplace_back(); } // node 0 = root

    void insert(const std::string& pattern) {
        int cur = 0;
        for (char c : pattern) {
            auto it = nodes_[cur].next.find(c);
            if (it == nodes_[cur].next.end()) {
                nodes_[cur].next[c] = static_cast<int>(nodes_.size());
                nodes_.emplace_back();
                cur = static_cast<int>(nodes_.size()) - 1;
            } else {
                cur = it->second;
            }
        }
        nodes_[cur].output.push_back(pattern);
    }

    // Build failure links via BFS. Must be called once after all inserts.
    void build() {
        std::queue<int> q;
        for (auto& [c, child] : nodes_[0].next) {
            nodes_[child].fail = 0; // depth-1 nodes fail back to root
            q.push(child);
        }
        while (!q.empty()) {
            int u = q.front(); q.pop();
            for (auto& [c, v] : nodes_[u].next) {
                // Walk failure chain from u's fail to find best suffix for c
                int f = nodes_[u].fail;
                while (f != 0 && !nodes_[f].next.count(c))
                    f = nodes_[f].fail;
                int fv = 0;
                if (nodes_[f].next.count(c) && nodes_[f].next.at(c) != v)
                    fv = nodes_[f].next.at(c);
                nodes_[v].fail = fv;
                // Inherit suffix outputs at build time so search is O(n+m+z)
                for (auto& kw : nodes_[fv].output)
                    nodes_[v].output.push_back(kw);
                q.push(v);
            }
        }
    }

    std::vector<emit> parse_text(const std::string& text) const {
        std::vector<emit> results;
        int cur = 0;
        for (size_t i = 0; i < text.size(); ++i) {
            char c = text[i];
            while (cur != 0 && !nodes_[cur].next.count(c))
                cur = nodes_[cur].fail;
            if (nodes_[cur].next.count(c))
                cur = nodes_[cur].next.at(c);
            for (auto& kw : nodes_[cur].output)
                results.push_back({kw, i + 1 - kw.size(), i});
        }
        return results;
    }
};

} // namespace aho_corasick
