# Contributing to Crucible

## Dev Setup

```bash
# 1. Clone and create virtualenv (Python 3.11 required — not 3.12+)
git clone https://github.com/your-org/crucible
cd crucible
python3.11 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements/pinned.txt   # Azure SDK — pinned, do not upgrade casually
pip install -r requirements/dev.txt      # everything else including base.txt

# 3. Build C++ policy engine
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release
cd ..

# 4. Verify everything works
pytest tests/unit/ tests/contracts/ -v
```

> **Note on install size:** `requirements/pinned.txt` includes `azure-ai-evaluation[redteam]`,
> which pulls in `pyrit` and its dependencies (HuggingFace `transformers`, `datasets`, etc.).
> Expect ~500MB on first install. This is expected and required for the red-team adapter.

## Test Commands

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

## Azure SDK Version Upgrade Protocol

**This protocol is mandatory. Skipping it has caused production incidents.**

The `azure-ai-evaluation` SDK breaks its own API between minor versions. The contract tests
in `tests/contracts/` are the only automated guard against silent breakage.

### When to upgrade

Only upgrade when:
- A specific bug fix or feature you need is in the new version
- A security advisory requires it
- Never upgrade speculatively or because `pip` suggests it

### How to upgrade

```bash
# 1. Create a dedicated branch
git checkout -b upgrade/azure-ai-evaluation-X.Y.Z

# 2. Update the version in pinned.txt
#    Change: azure-ai-evaluation[redteam]==OLD
#    To:     azure-ai-evaluation[redteam]==NEW
vim requirements/pinned.txt

# 3. Install the new version
pip install -r requirements/pinned.txt

# 4. Run contract tests IMMEDIATELY — before any other change
pytest tests/contracts/ -v

# 5. If any contract test fails: STOP
#    Do NOT proceed. Revert pinned.txt and close the branch.
#    Investigate what changed in the SDK, update the adapter and contract tests
#    on a separate analysis branch first.

# 6. If all contract tests pass: run the full suite
pytest tests/unit/ tests/contracts/ tests/performance/ -v

# 7. Update the comment at the top of requirements/pinned.txt with the new date
# 8. Merge only after the full suite is green
```

### What the contract tests cover

`tests/contracts/test_pyrit_contract.py` verifies:
- `RiskCategory` has `Violence`, `HateUnfairness`, `Sexual`, `SelfHarm` members
- `AttackStrategy` has `EASY`, `MODERATE`, `DIFFICULT`, `Jailbreak`, `Baseline` members
- `RedTeam.__init__` accepts `azure_ai_project`, `credential`, `risk_categories`, `num_objectives`
- `RedTeam.scan` accepts `target`, `attack_strategies`
- `RedTeamResult` has `scan_result`, `attack_details`, `to_json`, `to_scorecard`, `to_eval_qr_json_lines`
- `AttackDetails` dicts have `query`, `response`, `risk_category`, `attack_strategy`, `attack_complexity`

If the SDK changes any of these, the adapter (`crucible/adapters/pyrit_adapter.py`) must be
updated before re-pinning.

### Why all Azure imports are isolated in the adapter

`crucible/adapters/pyrit_adapter.py` is the **only file** that imports from `azure.ai.evaluation`.
Business logic calls `CrucibleRedTeamAdapter` — never the SDK directly.

This means an SDK breaking change requires updating exactly one file, not hunting through the codebase.

```python
# WRONG — never do this in business logic
from azure.ai.evaluation.red_team import RedTeam

# RIGHT — always go through the adapter
from crucible.adapters.pyrit_adapter import CrucibleRedTeamAdapter
```

## How to Add New Harm Categories

1. Add the category string → `RiskCategory` enum mapping to `CATEGORY_MAP` in
   `crucible/adapters/pyrit_adapter.py`
2. Add rules for the category to `data/rules.json` (follow existing format)
3. Add a contract test in `tests/contracts/test_pyrit_contract.py` asserting the
   new `RiskCategory` member exists
4. Rebuild and run: `pytest tests/unit/ tests/contracts/ -v`

## How to Add New Attack Strategies

1. Add the strategy string → `AttackStrategy` mapping to `STRATEGY_MAP` in
   `crucible/adapters/pyrit_adapter.py`
2. Add a contract test asserting the new `AttackStrategy` member exists
3. Run: `pytest tests/contracts/ -v`
