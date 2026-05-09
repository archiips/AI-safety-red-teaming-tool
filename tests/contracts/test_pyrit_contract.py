"""
Contract tests for azure-ai-evaluation red team SDK.
Run BEFORE any Azure SDK version change: pytest tests/contracts/ -v
If any test fails after a version bump, revert immediately.

Pinned version: azure-ai-evaluation==1.16.7
Verified: 2026-05-08
"""
import inspect
import pytest


@pytest.fixture(scope="module")
def red_team_module():
    from azure.ai.evaluation.red_team import RedTeam, RiskCategory, AttackStrategy
    return RedTeam, RiskCategory, AttackStrategy


@pytest.fixture(scope="module")
def red_team_result_class():
    from azure.ai.evaluation.red_team._red_team_result import RedTeamResult
    return RedTeamResult


# --- RiskCategory contracts ---

def test_risk_category_has_violence(red_team_module):
    _, RiskCategory, _ = red_team_module
    assert hasattr(RiskCategory, "Violence")


def test_risk_category_has_hate_unfairness(red_team_module):
    _, RiskCategory, _ = red_team_module
    assert hasattr(RiskCategory, "HateUnfairness")


def test_risk_category_has_sexual(red_team_module):
    _, RiskCategory, _ = red_team_module
    assert hasattr(RiskCategory, "Sexual")


def test_risk_category_has_self_harm(red_team_module):
    _, RiskCategory, _ = red_team_module
    assert hasattr(RiskCategory, "SelfHarm")


def test_risk_category_members_are_string_like(red_team_module):
    _, RiskCategory, _ = red_team_module
    assert isinstance(RiskCategory.Violence, str)


# --- AttackStrategy contracts ---

def test_attack_strategy_has_easy(red_team_module):
    _, _, AttackStrategy = red_team_module
    assert hasattr(AttackStrategy, "EASY")


def test_attack_strategy_has_moderate(red_team_module):
    _, _, AttackStrategy = red_team_module
    assert hasattr(AttackStrategy, "MODERATE")


def test_attack_strategy_has_difficult(red_team_module):
    _, _, AttackStrategy = red_team_module
    assert hasattr(AttackStrategy, "DIFFICULT")


def test_attack_strategy_has_jailbreak(red_team_module):
    _, _, AttackStrategy = red_team_module
    assert hasattr(AttackStrategy, "Jailbreak")


def test_attack_strategy_has_baseline(red_team_module):
    _, _, AttackStrategy = red_team_module
    assert hasattr(AttackStrategy, "Baseline")


# --- RedTeam constructor contract ---

def test_red_team_init_accepts_azure_ai_project(red_team_module):
    RedTeam, _, _ = red_team_module
    sig = inspect.signature(RedTeam.__init__)
    assert "azure_ai_project" in sig.parameters


def test_red_team_init_accepts_credential(red_team_module):
    RedTeam, _, _ = red_team_module
    sig = inspect.signature(RedTeam.__init__)
    assert "credential" in sig.parameters


def test_red_team_init_accepts_risk_categories(red_team_module):
    RedTeam, _, _ = red_team_module
    sig = inspect.signature(RedTeam.__init__)
    assert "risk_categories" in sig.parameters


def test_red_team_init_accepts_num_objectives(red_team_module):
    RedTeam, _, _ = red_team_module
    sig = inspect.signature(RedTeam.__init__)
    assert "num_objectives" in sig.parameters


# --- RedTeam.scan contract ---

def test_red_team_scan_exists(red_team_module):
    RedTeam, _, _ = red_team_module
    assert callable(getattr(RedTeam, "scan", None))


def test_red_team_scan_accepts_target(red_team_module):
    RedTeam, _, _ = red_team_module
    sig = inspect.signature(RedTeam.scan)
    assert "target" in sig.parameters


def test_red_team_scan_accepts_attack_strategies(red_team_module):
    RedTeam, _, _ = red_team_module
    sig = inspect.signature(RedTeam.scan)
    assert "attack_strategies" in sig.parameters


# --- RedTeamResult contracts ---

def test_red_team_result_has_scan_result(red_team_result_class):
    result = red_team_result_class(scan_result=None, attack_details=None)
    assert hasattr(result, "scan_result")


def test_red_team_result_has_attack_details(red_team_result_class):
    result = red_team_result_class(scan_result=None, attack_details=None)
    assert hasattr(result, "attack_details")


def test_red_team_result_has_to_json(red_team_result_class):
    assert callable(getattr(red_team_result_class, "to_json", None))


def test_red_team_result_has_to_scorecard(red_team_result_class):
    assert callable(getattr(red_team_result_class, "to_scorecard", None))


def test_red_team_result_has_to_eval_qr_json_lines(red_team_result_class):
    assert callable(getattr(red_team_result_class, "to_eval_qr_json_lines", None))


def test_red_team_result_to_json_returns_empty_string_when_no_scan_result(red_team_result_class):
    result = red_team_result_class(scan_result=None, attack_details=None)
    assert result.to_json() == ""


def test_red_team_result_to_scorecard_returns_none_when_no_scan_result(red_team_result_class):
    result = red_team_result_class(scan_result=None, attack_details=None)
    assert result.to_scorecard() is None


def test_red_team_result_to_eval_qr_returns_empty_when_no_attack_details(red_team_result_class):
    result = red_team_result_class(scan_result=None, attack_details=None)
    assert result.to_eval_qr_json_lines() == ""


def test_attack_details_expected_keys(red_team_result_class):
    """Attack details must contain these keys for the adapter to normalize correctly."""
    attack_detail = {
        "attack_technique": "Jailbreak",
        "attack_complexity": "easy",
        "risk_category": "Violence",
        "conversation": [
            {"role": "user", "content": "test prompt"},
            {"role": "assistant", "content": "test response"},
        ],
        "attack_success": True,
        "risk_assessment": None,
    }
    result = red_team_result_class(scan_result=None, attack_details=[attack_detail])
    lines = result.to_eval_qr_json_lines()
    assert isinstance(lines, list)
    assert len(lines) == 1
    import json
    parsed = json.loads(lines[0])
    assert "query" in parsed
    assert "response" in parsed
    assert "risk_category" in parsed
    assert "attack_strategy" in parsed
    assert "attack_complexity" in parsed
