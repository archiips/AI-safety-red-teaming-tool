# Crucible — CLAUDE.md
> This file is read by Claude Code at the start of every session. Follow every rule here without being asked.

## What This Project Is

**Crucible** is a full-stack, CI-native LLM adversarial testing (red-teaming) platform. It automatically generates, executes, and scores attacks against LLM applications, producing a severity heatmap and regression-ready CI/CD harness.

- **Full spec:** `PRD.md` — read Section 14 (Pitfall Registry) before touching any Azure or C++ code
- **Build plan:** `todo.md` — the authoritative source of what's done and what's next
- **Benchmarks:** `BENCHMARKS.md` — update this after every performance-related change

---

## MCP Servers

Configured in `.mcp.json`. Eight servers are set up for this project. Run `/mcp` in any Claude Code session to check their live status.

| Server | What It Gives You | Needs Running |
|---|---|---|
| `github` | Manage repo, issues, PRs, CI run status, code search | `GITHUB_PAT` env var set |
| `azure` | Control Azure AI Foundry, Container Apps, Content Safety | `az login` done |
| `db` | Query SQLite (dev) and PostgreSQL (prod) with natural language | DB file must exist |
| `redis` | Inspect Celery task queues, debug job state | `docker-compose up redis` |
| `playwright` | Automated browser testing of React frontend | Docker/Chromium |
| `ollama` | Pull models, run inference, compare outputs locally | `ollama serve` running |
| `docker` | List containers, fetch logs, manage Compose services | Docker Desktop running |
| `git` | Search git history, diff, log across the repo | Always available |

### When to Use Each MCP

- **Debugging a failed Celery task?** Use `redis` to inspect the queue, `docker` to check worker logs
- **Verifying DB schema after a migration?** Use `db` — ask it to describe the `scores` table or run the hot-path index check
- **Testing the heatmap UI?** Use `playwright` to navigate to the frontend, click cells, verify drill-down opens
- **Checking if Azure Content Safety API shape changed?** Use `azure` to inspect the resource, then run `pytest tests/contracts/`
- **Debugging Ollama inference?** Use `ollama` to list models, run a quick generate call, confirm phi4-mini is responding
- **Monitoring CI on a PR?** Use `github` to check workflow run status without leaving the editor
- **Searching for where a function was introduced?** Use `git` to search history and blame

### MCP One-Time Setup (Do These Before First Use)

These are things Claude Code cannot do for you — do them once in your terminal:

```bash
# 1. GitHub PAT — create at github.com/settings/tokens
#    Required scopes: repo, read:org, workflow
export GITHUB_PAT=ghp_your_token_here
# Add to ~/.zshrc so it persists across sessions

# 2. Azure CLI login
az login
# Opens browser for Microsoft auth. Your subscription appears after login.

# 3. Ollama — phi4-mini model (downloading in background, verify with:)
ollama list   # should show phi4-mini when done

# 4. Verify uvx is available (already installed)
uvx --version   # should print version number
```

### MCP Permissions

Read-only MCP operations (git log, db queries, redis get, ollama list, docker logs) are auto-approved in `.claude/settings.json`. Destructive operations (db DROP, redis FLUSHALL) are explicitly denied and will always require manual confirmation.

---

## Task Tracking — Mandatory

After completing ANY implementation work, immediately update `todo.md`. This is non-negotiable.

**Task file:** `todo.md` (in this directory)

### Format Rules

**Pending (untouched):**
```markdown
- [ ] **Task title**
  - [ ] Subtask one
```

**Completed:**
```markdown
- [x] **Task title**
  ✅ **Completed:** YYYY-MM-DD
  - [x] Subtask one
```

**Partially completed:**
```markdown
- [ ] **Task title**
  ⚠️ **Partially Completed:** YYYY-MM-DD
  - [x] Subtask done
  - [ ] Subtask remaining — blocked: reason
```

**Blocked:**
```markdown
- [ ] **Task title**
  🚧 **Blocked:** YYYY-MM-DD
  - [ ] Subtask — BLOCKER: what's missing
```

### Rules
- Change `[ ]` → `[x]` AND add the status line — both, always, never just one
- Mark each subtask `[x]` individually — do not bulk-check
- Do NOT check the parent task until every subtask is checked
- Use today's actual date in YYYY-MM-DD format — never "today"
- Add a one-line note if anything deviated from the plan
- Do not ask whether to mark something complete — just do it

---

## Project Structure

```
crucible/
├── cpp/                       # C++ policy engine source
│   ├── src/
│   │   ├── bindings.cpp       # pybind11 module definition
│   │   ├── severity.cpp       # PolicyEngine implementation
│   │   ├── aho_corasick.cpp   # Aho-Corasick pattern matching
│   │   └── unicode_norm.cpp   # Leetspeak + homoglyph normalization
│   └── include/
│       └── aho_corasick.hpp   # cjgdev header-only library
├── crucible/                  # Python package
│   ├── adapters/
│   │   └── pyrit_adapter.py   # ALL azure.ai.evaluation imports live here ONLY
│   ├── scorers/
│   │   ├── azure_cs_scorer.py
│   │   ├── llm_judge_scorer.py
│   │   └── fusion.py
│   ├── api/
│   │   ├── main.py
│   │   ├── routes/
│   │   └── websocket.py
│   ├── db/
│   │   └── models.py
│   └── tasks/
│       └── scan_task.py
├── frontend/                  # React 18 + TypeScript + Vite
├── tests/
│   ├── contracts/             # SDK contract tests — run on every push
│   ├── unit/                  # No network, no Azure
│   ├── integration/           # Requires real Azure services
│   ├── performance/           # GIL release benchmarks
│   └── e2e/                   # Full pipeline
├── data/
│   ├── rules.json             # C++ policy engine rules
│   ├── judge_prompt.txt       # LLM-as-judge system prompt
│   └── calibration_weights.json
├── requirements/
│   ├── base.txt
│   ├── dev.txt
│   └── pinned.txt             # PINNED Azure SDK versions — do not upgrade without running contract tests
├── scripts/
├── .env                       # Never commit — real secrets
├── .env.example               # Commit this — placeholders only
├── docker-compose.yml
├── PRD.md                     # Full product spec
├── todo.md                    # Task tracking
└── BENCHMARKS.md              # Performance results
```

---

## Claude Code Skills

Built-in skills available via `/skill-name` that are relevant to this project:

| Skill | When to Use |
|---|---|
| `/frontend-design` | Building or refining React components — heatmap, drill-down panel, run form |
| `/security-review` | Before any PR that touches the C++ engine, scoring pipeline, or auth middleware |
| `/simplify` | After implementing any phase — review for unnecessary complexity or abstraction |
| `/task-tracking` | Already embedded in workflow — updates `todo.md` after every task completion |

---

## Git Workflow

### Commit Rules
- One line, plain English, no punctuation at the end
- No "Co-Authored-By" or any Claude attribution — commits are yours
- Describe what changed, not why: `add aho-corasick trie builder`, `fix gil release on score method`
- Never commit directly to `main`

### Branch Strategy
One branch per todo.md phase. Create the branch when you start that phase. PR to `main` when the phase gate passes.

| Branch | Covers | Gate before PR |
|---|---|---|
| `feat/phase-1-foundation` | Repo setup, CMake, pybind11 hello world | GIL test ≥3× speedup |
| `feat/phase-2-cpp-engine` | Aho-Corasick, RE2, logistic head, benchmarks | Engine test + ≥10× speedup |
| `feat/phase-3-azure-pyrit` | Azure setup, PyRIT adapter, DB schema | All contract tests pass |
| `feat/phase-4-scoring` | Azure CS scorer, LLM judge, score fusion | All unit tests pass |
| `feat/phase-5-backend` | FastAPI, Celery, Redis, auth | API unit tests pass |
| `feat/phase-6-frontend` | React, heatmap, drill-down, WebSocket | Manual UI smoke test |
| `feat/phase-7-docker` | Docker Compose, multi-stage Dockerfile | `docker-compose up` works end-to-end |
| `feat/phase-8-e2e` | Full pipeline tests | E2E tests pass |
| `feat/phase-9-polish` | Heatmap polish, JSON export, manifest | Manual UI review |
| `feat/phase-10-cicd` | GitHub Actions, Azure Container Apps | CI green on all three jobs |
| `feat/phase-11-benchmarks` | Benchmark runs, ASR tables | BENCHMARKS.md complete |
| `feat/phase-12-publish` | README, blog post, PyRIT PR | Public release |

### When to Create a New Branch
- Start of each phase: `git checkout -b feat/phase-N-name`
- Never for hotfixes or tiny tweaks — commit directly on the current phase branch

### When to PR to Main
- Phase gate passes (see gate checklist in this file)
- All tests for that phase are green
- PR title = one line describing what the phase adds, e.g. `add cpp policy engine with aho-corasick`

### Commit + Push Workflow (After You Test a Feature)
1. You tell me "tests pass" or "it works"
2. I stage only the relevant files (never `git add .` blindly)
3. I commit with one short plain-English line
4. I push to the current phase branch: `git push origin <current-branch>`
5. I update `todo.md` to mark completed subtasks

---

## Non-Negotiable Rules

### 1. Never import `azure.ai.evaluation` outside the adapter
All imports from `azure.ai.evaluation` must live in `crucible/adapters/pyrit_adapter.py` and nowhere else. Business logic calls the adapter. This is the entire defense against PyRIT SDK breaking changes (PRD Pitfall #1).

```python
# WRONG — never do this in business logic
from azure.ai.evaluation.red_team import RedTeam

# RIGHT — always go through the adapter
from crucible.adapters.pyrit_adapter import CrucibleRedTeamAdapter
```

### 2. Run contract tests before touching any Azure SDK dependency
```bash
pytest tests/contracts/ -v
```
If any contract test fails after a version change: revert immediately, do not proceed.

### 3. Never upgrade Azure SDK packages without following the upgrade protocol
1. Branch: `git checkout -b upgrade/azure-ai-evaluation-X.Y.Z`
2. Update `requirements/pinned.txt`
3. `pytest tests/contracts/ -v` — if any fail, stop
4. If all pass, run full suite
5. Update `CHANGELOG.md`
6. Merge only after full suite is green

### 4. GIL must be released on every C++ hot path
Every `.def()` on a CPU-bound C++ method must have `py::call_guard<py::gil_scoped_release>()`. Missing it silently serializes all Celery workers and kills the 10× speedup claim.

```cpp
// REQUIRED on every hot-path method
.def("score", &PolicyEngine::score,
     py::call_guard<py::gil_scoped_release>())
```

Verify after any C++ change:
```bash
pytest tests/performance/test_policy_engine_perf.py -v -s
```

### 5. Never commit `.env` — it contains real Azure keys
Only `.env.example` is committed. Run `grep -r "AZURE_INFERENCE_KEY=" .` before any `git add` if you're unsure.

### 6. Default to Ollama for all LLM calls during development
`CRUCIBLE_USE_LOCAL_LLM=true` is the default in `.env.example`. Azure Phi-4-mini is used only for final benchmark runs. Never use Azure credits for unit or integration tests.

### 7. Never check a parent task complete while subtasks remain unchecked
This applies to `todo.md`. Partially done = ⚠️ status line, not a checked parent box.

---

## Running Tests

```bash
# Fast — run before every commit (no network, no Azure)
pytest tests/unit/ tests/contracts/ -v

# Medium — run before every PR (needs Docker Compose up for Redis)
pytest tests/unit/ tests/contracts/ tests/performance/ -v

# Full — nightly only, requires Azure credentials in .env
pytest tests/ -v --integration

# GIL release verification — run after any C++ change
pytest tests/performance/test_policy_engine_perf.py -v -s

# Contract tests alone — run before any Azure SDK version change
pytest tests/contracts/ -v
```

### Test Markers
- `@pytest.mark.integration` — skipped unless `--integration` flag passed
- `@pytest.mark.slow` — skipped unless `--slow` flag passed

---

## Building the C++ Engine

```bash
# First time
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release
cd ..

# After any C++ source change
cmake --build build --config Release

# Verify Python can import it
python3 -c "from crucible_policy import PolicyEngine; print('ok')"
```

**Required system dependencies:**
```bash
brew install cmake re2   # macOS
pip install pybind11
```

---

## Phase Gates — Do Not Cross Without Passing

| Gate | Command | Required Before |
|---|---|---|
| GIL Gate | `pytest tests/performance/test_gil_baseline.py` — must show ≥3× speedup | Leaving Week 1 |
| Engine Gate | `pytest tests/unit/ tests/performance/` — all pass, ≥10× speedup | Leaving Phase 2 |
| Contract Gate | `pytest tests/contracts/` — 100% pass on pinned SDK | Leaving Phase 3 |
| Pipeline Gate | `pytest tests/e2e/ --timeout=120` — full scan completes | Leaving Phase 8 |
| CI Gate | GitHub Actions green on all three jobs | Leaving Phase 10 |
| Benchmark Gate | `BENCHMARKS.md` has ≥10× C++ speedup + ASR tables | Leaving Phase 11 |

---

## Budget Rules

- Total Azure budget: **$100** (Azure for Students). This must last the entire project.
- Azure Content Safety F0 tier = **$0/month** (5,000 records/month free) — always use F0
- Phi-4-mini via Ollama = **$0** — use for all development
- Azure Phi-4-mini = ~$0.01/scan — use only for final benchmarks in Week 11
- Set Azure budget alerts: **$50** (warning email) and **$80** (stop non-essential usage)
- If credits hit $80: disable all Azure LLM calls, switch to Ollama-only mode

---

## Critical Pitfalls (Summary — Full Detail in PRD Section 14)

| # | Pitfall | Fast Check |
|---|---|---|
| 1 | PyRIT SDK API breaks between minor versions | `pytest tests/contracts/ -v` |
| 2 | GIL not released — no C++ speedup | `pytest tests/performance/ -v -s` |
| 3 | Missing `pybind11/stl.h` — STL type errors | Check `#include <pybind11/stl.h>` in `bindings.cpp` |
| 4 | Symbol visibility on Linux CI | `nm -D build/crucible_policy*.so \| grep " T " \| grep -v PyInit` |
| 5 | C++ destructor deadlock on Celery shutdown | `pytest tests/unit/test_policy_engine_lifecycle.py` |
| 6 | Azure credit exhaustion | Check Azure cost dashboard every Monday |
| 7 | Isotonic calibration with too few labels | Use HarmBench (510 examples) not manual annotation |
| 8 | C++ module not importable in Celery workers | `pytest tests/integration/test_celery_worker.py` |

---

## Key Architectural Decisions (Do Not Revisit Without Good Reason)

- **SQLite in dev, PostgreSQL in prod** — do not add PostgreSQL to docker-compose until Phase 7
- **Celery over ARQ** — chosen for retry semantics and Flower monitoring; ARQ would be fine for I/O-bound but Celery is the right call here
- **Ollama as default LLM** — always `CRUCIBLE_USE_LOCAL_LLM=true` unless explicitly running benchmarks
- **HarmBench for calibration labels** — do not manually annotate; 510 HarmBench examples are sufficient
- **JSON report only, no PDF** — PDF export is explicitly out of scope
- **Adapter pattern for all external SDKs** — Azure SDK, not just PyRIT. If a new Azure client is added, it goes in `crucible/adapters/`

---

## Scoring Weights (Starting Point — Tune After Calibration)

```
composite_severity = 0.2 × cpp_score + 0.5 × azure_cs_score + 0.3 × llm_judge_score
```

All three signals calibrated to 0–7 via isotonic regression before fusion. Cohen's κ computed between each pair and stored in `score_fusion` table per run.

---

## Azure Content Safety Response Shape

The API always returns exactly this shape — design everything around it:

```json
{
  "categoriesAnalysis": [
    {"category": "Hate",     "severity": 0},
    {"category": "SelfHarm", "severity": 0},
    {"category": "Sexual",   "severity": 0},
    {"category": "Violence", "severity": 4}
  ]
}
```

Severity is an integer 0–7. Four categories, always present, always in this order.
