"""Unit tests for CrucibleRedTeamAdapter — no real Azure calls."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _make_result(attack_details=None, scan_result=None):
    from azure.ai.evaluation.red_team._red_team_result import RedTeamResult
    return RedTeamResult(scan_result=scan_result, attack_details=attack_details)


def _make_detail(
    category="Violence",
    technique="Jailbreak",
    complexity="easy",
    prompt="harm intent",
    response="refused",
    attack_success=False,
):
    return {
        "risk_category": category,
        "attack_technique": technique,
        "attack_complexity": complexity,
        "conversation": [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": response},
        ],
        "attack_success": attack_success,
        "risk_assessment": None,
    }


# --- CATEGORY_MAP tests ---

def test_adapter_maps_violence_category():
    from azure.ai.evaluation.red_team import RiskCategory
    from crucible.adapters.pyrit_adapter import CATEGORY_MAP
    assert CATEGORY_MAP["violence"] == RiskCategory.Violence


def test_adapter_maps_hate_category():
    from azure.ai.evaluation.red_team import RiskCategory
    from crucible.adapters.pyrit_adapter import CATEGORY_MAP
    assert CATEGORY_MAP["hate"] == RiskCategory.HateUnfairness


def test_adapter_maps_sexual_category():
    from azure.ai.evaluation.red_team import RiskCategory
    from crucible.adapters.pyrit_adapter import CATEGORY_MAP
    assert CATEGORY_MAP["sexual"] == RiskCategory.Sexual


def test_adapter_maps_self_harm_category():
    from azure.ai.evaluation.red_team import RiskCategory
    from crucible.adapters.pyrit_adapter import CATEGORY_MAP
    assert CATEGORY_MAP["self_harm"] == RiskCategory.SelfHarm


def test_adapter_maps_category_strings_to_risk_category_enum():
    from azure.ai.evaluation.red_team import RiskCategory
    from crucible.adapters.pyrit_adapter import CATEGORY_MAP
    for key, val in CATEGORY_MAP.items():
        assert isinstance(val, RiskCategory), f"{key} did not map to RiskCategory"


def test_unknown_category_raises_key_error():
    from crucible.adapters.pyrit_adapter import CATEGORY_MAP
    with pytest.raises(KeyError):
        _ = CATEGORY_MAP["not_a_real_category"]


# --- STRATEGY_MAP tests ---

def test_adapter_maps_easy_strategy():
    from azure.ai.evaluation.red_team import AttackStrategy
    from crucible.adapters.pyrit_adapter import STRATEGY_MAP
    assert STRATEGY_MAP["easy"] == AttackStrategy.EASY


def test_adapter_maps_moderate_strategy():
    from azure.ai.evaluation.red_team import AttackStrategy
    from crucible.adapters.pyrit_adapter import STRATEGY_MAP
    assert STRATEGY_MAP["moderate"] == AttackStrategy.MODERATE


def test_adapter_maps_difficult_strategy():
    from azure.ai.evaluation.red_team import AttackStrategy
    from crucible.adapters.pyrit_adapter import STRATEGY_MAP
    assert STRATEGY_MAP["difficult"] == AttackStrategy.DIFFICULT


def test_adapter_maps_strategy_strings_to_attack_strategy_enum():
    from azure.ai.evaluation.red_team import AttackStrategy
    from crucible.adapters.pyrit_adapter import STRATEGY_MAP
    for key, val in STRATEGY_MAP.items():
        assert isinstance(val, AttackStrategy), f"{key} did not map to AttackStrategy"


# --- _normalize_result tests ---

def test_adapter_normalize_result_returns_list_of_dicts():
    from crucible.adapters.pyrit_adapter import CrucibleRedTeamAdapter
    result = _make_result(attack_details=[_make_detail()])
    normalized = CrucibleRedTeamAdapter.__new__(CrucibleRedTeamAdapter)._normalize_result(result)
    assert isinstance(normalized, list)
    assert all(isinstance(item, dict) for item in normalized)


def test_adapter_normalize_result_has_required_keys():
    from crucible.adapters.pyrit_adapter import CrucibleRedTeamAdapter
    result = _make_result(attack_details=[_make_detail()])
    normalized = CrucibleRedTeamAdapter.__new__(CrucibleRedTeamAdapter)._normalize_result(result)
    assert len(normalized) == 1
    item = normalized[0]
    assert "category" in item
    assert "strategy" in item
    assert "prompt" in item
    assert "seed" in item


def test_adapter_normalize_result_extracts_prompt_and_response():
    from crucible.adapters.pyrit_adapter import CrucibleRedTeamAdapter
    detail = _make_detail(prompt="attack text", response="model reply")
    result = _make_result(attack_details=[detail])
    normalized = CrucibleRedTeamAdapter.__new__(CrucibleRedTeamAdapter)._normalize_result(result)
    assert normalized[0]["prompt"] == "attack text"
    assert normalized[0]["response"] == "model reply"
    assert normalized[0]["seed"] == "attack text"


def test_adapter_normalize_result_empty_when_no_attack_details():
    from crucible.adapters.pyrit_adapter import CrucibleRedTeamAdapter
    result = _make_result(attack_details=None)
    normalized = CrucibleRedTeamAdapter.__new__(CrucibleRedTeamAdapter)._normalize_result(result)
    assert normalized == []


def test_adapter_normalize_result_multiple_details():
    from crucible.adapters.pyrit_adapter import CrucibleRedTeamAdapter
    details = [_make_detail(category="Violence"), _make_detail(category="Sexual")]
    result = _make_result(attack_details=details)
    normalized = CrucibleRedTeamAdapter.__new__(CrucibleRedTeamAdapter)._normalize_result(result)
    assert len(normalized) == 2
    categories = {item["category"] for item in normalized}
    assert "Violence" in categories
    assert "Sexual" in categories


def test_adapter_normalize_preserves_attack_success():
    from crucible.adapters.pyrit_adapter import CrucibleRedTeamAdapter
    result = _make_result(attack_details=[_make_detail(attack_success=True)])
    normalized = CrucibleRedTeamAdapter.__new__(CrucibleRedTeamAdapter)._normalize_result(result)
    assert normalized[0]["attack_success"] is True


def test_adapter_normalize_severity_label_from_risk_assessment():
    from crucible.adapters.pyrit_adapter import CrucibleRedTeamAdapter
    detail = _make_detail()
    detail["risk_assessment"] = {"Violence": {"severity_label": "high"}}
    result = _make_result(attack_details=[detail])
    normalized = CrucibleRedTeamAdapter.__new__(CrucibleRedTeamAdapter)._normalize_result(result)
    assert normalized[0]["severity_label"] == "high"


# --- Integration test (requires Azure, skipped by default) ---

@pytest.mark.integration
@pytest.mark.asyncio
async def test_real_scan_generates_at_least_one_attack():
    """Requires AZURE_AI_PROJECT and valid credential in environment."""
    import os
    from azure.identity import DefaultAzureCredential
    from crucible.adapters.pyrit_adapter import CrucibleRedTeamAdapter

    project = os.environ.get("AZURE_AI_PROJECT")
    if not project:
        pytest.skip("AZURE_AI_PROJECT not set")

    async def dummy_target(query):
        return "I cannot help with that."

    adapter = CrucibleRedTeamAdapter(
        azure_ai_project=project,
        credential=DefaultAzureCredential(),
        categories=["violence"],
        num_objectives=2,
    )
    results = await adapter.scan(target=dummy_target, strategies=["easy"])
    assert len(results) >= 1
    assert "prompt" in results[0]
    assert "category" in results[0]
