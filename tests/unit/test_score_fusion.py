"""Unit tests for ScoreFusion and compute_kappa."""
import json
import pytest
from pathlib import Path


@pytest.fixture
def tmp_weights(tmp_path):
    """Write a valid calibration_weights.json to a temp path."""
    weights = {"cpp": 0.2, "azure_cs": 0.5, "llm_judge": 0.3}
    p = tmp_path / "calibration_weights.json"
    p.write_text(json.dumps(weights))
    return p


@pytest.fixture
def fusion(tmp_weights):
    from crucible.scorers.fusion import ScoreFusion
    return ScoreFusion(weights_path=tmp_weights)


# ── Fusion output ──────────────────────────────────────────────────────────────

def test_fusion_output_between_0_and_7(fusion):
    result = fusion.fuse(cpp_score=3.0, azure_score=4.0, judge_score=5.0)
    assert 0.0 <= result.composite_severity <= 7.0


def test_fusion_weights_sum_to_1(fusion):
    result = fusion.fuse(1.0, 2.0, 3.0)
    total = result.cpp_weight + result.azure_cs_weight + result.llm_judge_weight
    assert abs(total - 1.0) < 1e-9


def test_fusion_result_has_all_required_fields(fusion):
    result = fusion.fuse(1.0, 2.0, 3.0)
    assert hasattr(result, "composite_severity")
    assert hasattr(result, "cpp_score")
    assert hasattr(result, "azure_cs_score")
    assert hasattr(result, "llm_judge_score")
    assert hasattr(result, "cpp_weight")
    assert hasattr(result, "azure_cs_weight")
    assert hasattr(result, "llm_judge_weight")


def test_fusion_composite_matches_expected_formula(fusion):
    # weights: cpp=0.2, azure=0.5, judge=0.3 (normalised from 0.2/0.5/0.3 → same)
    result = fusion.fuse(cpp_score=0.0, azure_score=7.0, judge_score=0.0)
    # composite = 0.2*0 + 0.5*7 + 0.3*0 = 3.5
    assert abs(result.composite_severity - 3.5) < 0.01


def test_fusion_clamps_above_7(fusion):
    result = fusion.fuse(7.0, 7.0, 7.0)
    assert result.composite_severity <= 7.0


def test_fusion_clamps_below_0(fusion):
    # Negative scores are not expected but should be handled gracefully
    result = fusion.fuse(-1.0, -1.0, -1.0)
    assert result.composite_severity >= 0.0


def test_fusion_uses_fallback_weights_when_no_file():
    from crucible.scorers.fusion import ScoreFusion
    # Pass a path that doesn't exist → should fall back to hardcoded defaults
    sf = ScoreFusion(weights_path="/tmp/__nonexistent_weights_12345.json")
    result = sf.fuse(1.0, 2.0, 3.0)
    assert 0.0 <= result.composite_severity <= 7.0
    assert abs(result.cpp_weight + result.azure_cs_weight + result.llm_judge_weight - 1.0) < 1e-9


def test_fusion_kappa_fields_passed_through(fusion):
    result = fusion.fuse(1.0, 2.0, 3.0, kappa_cpp_azure=0.7, kappa_cpp_judge=0.5, kappa_azure_judge=0.6)
    assert result.kappa_cpp_azure == 0.7
    assert result.kappa_cpp_judge == 0.5
    assert result.kappa_azure_judge == 0.6


def test_calibration_weights_loaded_on_init(tmp_weights):
    from crucible.scorers.fusion import ScoreFusion
    sf = ScoreFusion(weights_path=tmp_weights)
    # Weights are loaded and normalised to sum to 1
    assert abs(sf._w_cpp + sf._w_azure + sf._w_judge - 1.0) < 1e-9


# ── Cohen's κ ─────────────────────────────────────────────────────────────────

def test_kappa_between_identical_signals_is_1():
    from crucible.scorers.fusion import compute_kappa
    scores = [0.0, 1.5, 3.0, 5.0, 7.0, 2.0, 6.0, 4.0]
    kappa = compute_kappa(scores, scores)
    assert kappa == pytest.approx(1.0, abs=1e-6)


def test_kappa_between_random_signals_near_0():
    from crucible.scorers.fusion import compute_kappa
    # Perfectly anti-correlated signals → κ should be negative or near 0
    a = [0.0, 0.0, 7.0, 7.0]
    b = [7.0, 7.0, 0.0, 0.0]
    kappa = compute_kappa(a, b)
    assert kappa < 0.5  # Definitely not strong agreement


def test_kappa_returns_zero_for_too_short_input():
    from crucible.scorers.fusion import compute_kappa
    assert compute_kappa([], []) == 0.0
    assert compute_kappa([1.0], [1.0]) == 0.0
