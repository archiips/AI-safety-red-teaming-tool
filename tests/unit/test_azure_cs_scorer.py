"""Unit tests for AzureContentSafetyScorer using mocks — no real Azure calls."""
import pytest
from unittest.mock import MagicMock, patch


@pytest.fixture
def mock_cs_client():
    """Build a mock ContentSafetyClient that returns a canned response."""
    category_items = [
        MagicMock(category="Hate",     severity=0),
        MagicMock(category="SelfHarm", severity=1),
        MagicMock(category="Sexual",   severity=0),
        MagicMock(category="Violence", severity=5),
    ]
    response = MagicMock()
    response.categories_analysis = category_items

    client = MagicMock()
    client.analyze_text.return_value = response
    return client


@pytest.fixture
def scorer(mock_cs_client):
    from crucible.scorers.azure_cs_scorer import AzureContentSafetyScorer

    # ContentSafetyClient is lazily imported in __init__; bypass it by directly setting _client
    scorer = AzureContentSafetyScorer.__new__(AzureContentSafetyScorer)
    scorer._client = mock_cs_client
    return scorer


def test_scorer_maps_all_four_categories(scorer):
    result = scorer.score("I want to hurt someone", category="violence")
    assert set(result.raw_scores.keys()) == {"Hate", "SelfHarm", "Sexual", "Violence"}


def test_scorer_returns_severity_between_0_and_7(scorer):
    result = scorer.score("test text", category="violence")
    assert 0.0 <= result.severity <= 7.0


def test_scorer_returns_violence_severity(scorer):
    result = scorer.score("I want to hurt someone", category="violence")
    assert result.severity == 5.0


def test_scorer_handles_rate_limit_with_retry(mock_cs_client):
    from azure.core.exceptions import HttpResponseError
    from crucible.scorers.azure_cs_scorer import AzureContentSafetyScorer

    # First call raises 429, second succeeds
    rate_limit_exc = HttpResponseError(message="Too Many Requests")
    rate_limit_exc.status_code = 429

    good_response = MagicMock()
    good_response.categories_analysis = [
        MagicMock(category="Hate",     severity=0),
        MagicMock(category="SelfHarm", severity=0),
        MagicMock(category="Sexual",   severity=0),
        MagicMock(category="Violence", severity=2),
    ]
    mock_cs_client.analyze_text.side_effect = [rate_limit_exc, good_response]

    scorer = AzureContentSafetyScorer.__new__(AzureContentSafetyScorer)
    scorer._client = mock_cs_client

    with patch("time.sleep"):  # Don't actually sleep in tests
        result = scorer.score("test", category="violence")
    assert result.severity == 2.0
    assert mock_cs_client.analyze_text.call_count == 2


def test_scorer_raises_on_repeated_api_failure(mock_cs_client):
    from azure.core.exceptions import HttpResponseError
    from crucible.scorers.azure_cs_scorer import AzureContentSafetyScorer, AzureContentSafetyError

    exc = HttpResponseError(message="Internal Server Error")
    exc.status_code = 500
    mock_cs_client.analyze_text.side_effect = exc

    scorer = AzureContentSafetyScorer.__new__(AzureContentSafetyScorer)
    scorer._client = mock_cs_client

    with pytest.raises(AzureContentSafetyError):
        scorer.score("test", category="violence")


def test_scorer_type_is_azure_cs(scorer):
    result = scorer.score("some text", category="hate")
    assert result.scorer_type == "azure_cs"
