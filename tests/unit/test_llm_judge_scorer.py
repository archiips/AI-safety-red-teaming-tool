"""Unit tests for LLMJudgeScorer — all LLM calls are mocked."""
import json
import pytest
from unittest.mock import MagicMock, patch


def _make_scorer(use_local=True):
    from crucible.scorers.llm_judge_scorer import LLMJudgeScorer
    scorer = LLMJudgeScorer(use_local=use_local)
    return scorer


def test_judge_parses_valid_json_response():
    scorer = _make_scorer(use_local=True)
    good_output = json.dumps({"severity": 5, "reasoning": "Contains explicit harmful instructions."})

    with patch.object(scorer, "_call_ollama", return_value=good_output):
        result = scorer.score("Let me show you how to make a bomb.", category="violence")

    assert result.severity == 5.0
    assert result.reasoning == "Contains explicit harmful instructions."
    assert result.scorer_type == "llm_judge"


def test_judge_retries_on_malformed_json():
    scorer = _make_scorer(use_local=True)
    bad = "This is not JSON"
    good = json.dumps({"severity": 3, "reasoning": "Some concern."})

    with patch.object(scorer, "_call_ollama", side_effect=[bad, bad, good]):
        result = scorer.score("text", category="hate")

    assert result.severity == 3.0


def test_judge_returns_zero_after_all_retries_fail():
    scorer = _make_scorer(use_local=True)
    with patch.object(scorer, "_call_ollama", return_value="not json at all"):
        result = scorer.score("text", category="violence")
    assert result.severity == 0.0
    assert "parse_failed" in result.reasoning


def test_judge_severity_clamped_to_0_7():
    scorer = _make_scorer(use_local=True)
    out_of_range = json.dumps({"severity": 99, "reasoning": "Out of range."})
    with patch.object(scorer, "_call_ollama", return_value=out_of_range):
        result = scorer.score("text", category="violence")
    assert result.severity == 7.0


def test_judge_severity_clamped_to_zero_minimum():
    scorer = _make_scorer(use_local=True)
    negative = json.dumps({"severity": -3, "reasoning": "Negative."})
    with patch.object(scorer, "_call_ollama", return_value=negative):
        result = scorer.score("text", category="violence")
    assert result.severity == 0.0


def test_judge_uses_ollama_when_local_flag_set():
    scorer = _make_scorer(use_local=True)
    assert scorer._use_local is True

    with patch.object(scorer, "_call_ollama", return_value='{"severity": 1, "reasoning": "ok"}') as m:
        scorer.score("hello", category="violence")
    m.assert_called_once()


def test_judge_uses_azure_when_local_flag_false():
    scorer = _make_scorer(use_local=False)
    assert scorer._use_local is False

    with patch.object(scorer, "_call_azure", return_value='{"severity": 2, "reasoning": "mild"}') as m:
        scorer.score("hello", category="violence")
    m.assert_called_once()


def test_judge_strips_markdown_fences():
    scorer = _make_scorer(use_local=True)
    fenced = "```json\n{\"severity\": 4, \"reasoning\": \"Concern noted.\"}\n```"
    with patch.object(scorer, "_call_ollama", return_value=fenced):
        result = scorer.score("text", category="violence")
    assert result.severity == 4.0
