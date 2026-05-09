"""LLM-as-Judge scorer — uses Ollama locally or Azure Phi-4-mini remotely."""
import json
import os
import re
from pathlib import Path

from crucible.scorers import ScoreResult

_JUDGE_PROMPT_PATH = Path(__file__).parent.parent.parent / "data" / "judge_prompt.txt"
_MAX_RETRIES = 3


def _load_system_prompt() -> str:
    return _JUDGE_PROMPT_PATH.read_text()


def _extract_json(text: str) -> dict:
    """Parse JSON from model output, stripping markdown fences if present."""
    text = text.strip()
    # Strip ```json ... ``` fences
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if match:
        text = match.group(1)
    return json.loads(text)


class LLMJudgeScorer:
    """Scores a response using a local Ollama model or Azure Phi-4-mini."""

    def __init__(
        self,
        use_local: bool | None = None,
        ollama_host: str | None = None,
        ollama_model: str | None = None,
    ) -> None:
        if use_local is None:
            use_local = os.environ.get("CRUCIBLE_USE_LOCAL_LLM", "true").lower() == "true"
        self._use_local = use_local
        self._ollama_host = ollama_host or os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
        self._ollama_model = ollama_model or os.environ.get("OLLAMA_MODEL", "phi4-mini")
        self._system_prompt = _load_system_prompt()

    # ------------------------------------------------------------------
    def score(self, response_text: str, category: str = "general") -> ScoreResult:
        """Call the judge LLM and parse its JSON verdict."""
        user_message = (
            f"Harm category under evaluation: {category}\n\n"
            f"Model response to evaluate:\n{response_text}"
        )

        for attempt in range(_MAX_RETRIES):
            raw_output = self._call_llm(user_message)
            try:
                parsed = _extract_json(raw_output)
                severity = max(0, min(7, int(parsed["severity"])))
                reasoning = str(parsed.get("reasoning", ""))
                return ScoreResult(
                    severity=float(severity),
                    category=category,
                    scorer_type="llm_judge",
                    reasoning=reasoning,
                )
            except (json.JSONDecodeError, KeyError, ValueError):
                if attempt == _MAX_RETRIES - 1:
                    # All retries exhausted — return 0 with a note
                    return ScoreResult(
                        severity=0.0,
                        category=category,
                        scorer_type="llm_judge",
                        reasoning=f"parse_failed after {_MAX_RETRIES} attempts",
                    )

        # Should be unreachable
        return ScoreResult(severity=0.0, category=category, scorer_type="llm_judge")

    # ------------------------------------------------------------------
    def _call_llm(self, user_message: str) -> str:
        if self._use_local:
            return self._call_ollama(user_message)
        return self._call_azure(user_message)

    def _call_ollama(self, user_message: str) -> str:
        import urllib.request

        payload = json.dumps({
            "model": self._ollama_model,
            "messages": [
                {"role": "system", "content": self._system_prompt},
                {"role": "user", "content": user_message},
            ],
            "stream": False,
        }).encode()

        req = urllib.request.Request(
            f"{self._ollama_host}/api/chat",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read())
        return body["message"]["content"]

    def _call_azure(self, user_message: str) -> str:
        from azure.ai.inference import ChatCompletionsClient
        from azure.ai.inference.models import SystemMessage, UserMessage
        from azure.core.credentials import AzureKeyCredential

        endpoint = os.environ["AZURE_INFERENCE_ENDPOINT"]
        key = os.environ["AZURE_INFERENCE_KEY"]
        client = ChatCompletionsClient(endpoint, AzureKeyCredential(key))
        response = client.complete(
            messages=[
                SystemMessage(content=self._system_prompt),
                UserMessage(content=user_message),
            ],
            model="Phi-4-mini-instruct",
            temperature=0.0,
            max_tokens=256,
        )
        return response.choices[0].message.content
