"""Azure Content Safety scorer — all azure-ai-contentsafety imports isolated here."""
import os
import time
from typing import Optional

from crucible.scorers import ScoreResult

# Azure CS maps its categories to these 4 names
_AZURE_CATEGORIES = ("Hate", "SelfHarm", "Sexual", "Violence")

# Map Azure category names to our internal harm category keys
_CATEGORY_ALIAS: dict[str, str] = {
    "Hate": "hate",
    "SelfHarm": "self_harm",
    "Sexual": "sexual",
    "Violence": "violence",
}


class AzureContentSafetyScorer:
    """Wraps azure-ai-contentsafety and returns a 0–7 severity score."""

    def __init__(
        self,
        endpoint: Optional[str] = None,
        key: Optional[str] = None,
    ) -> None:
        from azure.ai.contentsafety import ContentSafetyClient
        from azure.core.credentials import AzureKeyCredential

        endpoint = endpoint or os.environ["AZURE_CONTENT_SAFETY_ENDPOINT"]
        key = key or os.environ["AZURE_CONTENT_SAFETY_KEY"]
        self._client = ContentSafetyClient(endpoint, AzureKeyCredential(key))

    def score(self, response_text: str, category: str = "violence") -> ScoreResult:
        """Score text against all four Azure CS categories, return severity for the requested category."""
        from azure.ai.contentsafety.models import AnalyzeTextOptions
        from azure.core.exceptions import HttpResponseError

        max_retries = 4
        delay = 1.0
        for attempt in range(max_retries):
            try:
                request = AnalyzeTextOptions(text=response_text)
                response = self._client.analyze_text(request)
                break
            except HttpResponseError as exc:
                if exc.status_code == 429 and attempt < max_retries - 1:
                    time.sleep(delay)
                    delay *= 2
                    continue
                raise AzureContentSafetyError(
                    f"Azure Content Safety API error after {attempt + 1} attempt(s): {exc}"
                ) from exc

        raw: dict[str, float] = {}
        for item in response.categories_analysis:
            raw[item.category] = float(item.severity)

        # Pick the severity for the requested harm category (best-effort alias match)
        internal_to_azure = {v: k for k, v in _CATEGORY_ALIAS.items()}
        azure_key = internal_to_azure.get(category, category.capitalize())
        severity = raw.get(azure_key, max(raw.values(), default=0.0))

        return ScoreResult(
            severity=severity,
            category=category,
            scorer_type="azure_cs",
            raw_scores=raw,
        )


class AzureContentSafetyError(RuntimeError):
    pass
