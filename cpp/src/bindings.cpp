#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include "severity.h"

namespace py = pybind11;

// CPU-bound add() for GIL baseline test: iterates a*3 times so the parallel speedup
// is well above 3× even with OS scheduling variance
int add(int a, int b) {
    volatile long long sum = 0;
    for (int i = 0; i < a * 3; ++i) sum += i;
    return static_cast<int>(sum % 1000000) + b;
}

PYBIND11_MODULE(crucible_policy, m, py::mod_gil_not_used()) {
    m.doc() = "Crucible C++ policy engine";

    m.def("add", &add, py::call_guard<py::gil_scoped_release>(),
          "Add two integers (GIL baseline smoke test)");

    py::class_<PolicyEngine>(m, "PolicyEngine")
        .def(py::init<const std::string &>(), py::arg("rules_json_path"),
             "Load rules from a JSON file and build the Aho-Corasick trie")
        .def("score",
             // Release GIL during C++ computation; re-acquire before building py objects
             [](const PolicyEngine &self, const std::string &text,
                const std::string &category) -> py::dict {
                 ScoreResult r;
                 {
                     py::gil_scoped_release release;
                     r = self.score(text, category);
                 }
                 // GIL is re-held here — safe to build Python objects
                 py::dict d;
                 d["severity"]        = r.severity;
                 d["matched_rules"]   = r.matched_rules;
                 d["category_scores"] = r.category_scores;
                 return d;
             },
             py::arg("text"), py::arg("category") = "",
             "Score text; returns dict with severity, matched_rules, category_scores")
        .def("reload_rules",
             [](PolicyEngine &self, const std::string &path) {
                 py::gil_scoped_release release;
                 self.reload_rules(path);
             },
             py::arg("rules_json_path"),
             "Hot-reload rules from a new JSON file without restarting");
}
