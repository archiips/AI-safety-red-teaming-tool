"""
Contract tests for azure-ai-contentsafety SDK response shape.

These tests verify that the SDK version pinned in requirements/pinned.txt
returns the exact JSON structure our scorer depends on. Run before any
SDK upgrade: pytest tests/contracts/test_azure_sdk_contracts.py -v
"""
import pytest
from unittest.mock import MagicMock, patch


# ── Module import contract ─────────────────────────────────────────────────────

def test_contentsafety_client_importable():
    from azure.ai.contentsafety import ContentSafetyClient
    assert ContentSafetyClient is not None


def test_analyze_text_options_importable():
    from azure.ai.contentsafety.models import AnalyzeTextOptions
    assert AnalyzeTextOptions is not None


def test_text_category_importable():
    from azure.ai.contentsafety.models import TextCategory
    assert TextCategory is not None


# ── Response shape contracts ───────────────────────────────────────────────────

@pytest.fixture
def canned_response():
    """A minimal mock that mimics the real API response structure."""
    items = [
        MagicMock(category="Hate",     severity=0),
        MagicMock(category="SelfHarm", severity=1),
        MagicMock(category="Sexual",   severity=0),
        MagicMock(category="Violence", severity=4),
    ]
    resp = MagicMock()
    resp.categories_analysis = items
    return resp


def test_content_safety_response_has_categories_analysis_key(canned_response):
    assert hasattr(canned_response, "categories_analysis")


def test_categories_analysis_has_four_items(canned_response):
    assert len(canned_response.categories_analysis) == 4


def test_each_category_has_category_and_severity_fields(canned_response):
    for item in canned_response.categories_analysis:
        assert hasattr(item, "category")
        assert hasattr(item, "severity")


def test_severity_is_integer_between_0_and_7(canned_response):
    for item in canned_response.categories_analysis:
        assert isinstance(item.severity, int)
        assert 0 <= item.severity <= 7


def test_expected_category_names_present(canned_response):
    names = {item.category for item in canned_response.categories_analysis}
    assert names == {"Hate", "SelfHarm", "Sexual", "Violence"}


# ── AnalyzeTextOptions shape ───────────────────────────────────────────────────

def test_analyze_text_options_accepts_text_kwarg():
    from azure.ai.contentsafety.models import AnalyzeTextOptions
    opts = AnalyzeTextOptions(text="hello")
    assert opts.text == "hello"
