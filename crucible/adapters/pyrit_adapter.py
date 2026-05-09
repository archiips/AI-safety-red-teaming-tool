"""
PyRIT adapter — ALL azure.ai.evaluation imports live here and NOWHERE else.
Business logic calls CrucibleRedTeamAdapter; never imports azure.ai.evaluation directly.
This isolation is the entire defense against PyRIT SDK breaking changes (PRD Pitfall #1).
"""
from typing import Any, Callable, Dict, List, Optional

from azure.ai.evaluation.red_team import AttackStrategy, RedTeam, RiskCategory
from azure.ai.evaluation.red_team._red_team_result import RedTeamResult


CATEGORY_MAP: Dict[str, RiskCategory] = {
    "violence": RiskCategory.Violence,
    "hate": RiskCategory.HateUnfairness,
    "hate_unfairness": RiskCategory.HateUnfairness,
    "sexual": RiskCategory.Sexual,
    "self_harm": RiskCategory.SelfHarm,
    "selfharm": RiskCategory.SelfHarm,
    "code_vulnerability": RiskCategory.CodeVulnerability,
    "code": RiskCategory.CodeVulnerability,
    "prohibited_actions": RiskCategory.ProhibitedActions,
    "prohibited": RiskCategory.ProhibitedActions,
    "protected_material": RiskCategory.ProtectedMaterial,
    "sensitive_data": RiskCategory.SensitiveDataLeakage,
    "sensitive_data_leakage": RiskCategory.SensitiveDataLeakage,
    "task_adherence": RiskCategory.TaskAdherence,
    "ungrounded_attributes": RiskCategory.UngroundedAttributes,
}

STRATEGY_MAP: Dict[str, AttackStrategy] = {
    "easy": AttackStrategy.EASY,
    "moderate": AttackStrategy.MODERATE,
    "difficult": AttackStrategy.DIFFICULT,
    "baseline": AttackStrategy.Baseline,
    "jailbreak": AttackStrategy.Jailbreak,
    "crescendo": AttackStrategy.Crescendo,
    "multi_turn": AttackStrategy.MultiTurn,
    "multiturn": AttackStrategy.MultiTurn,
    "base64": AttackStrategy.Base64,
    "leetspeak": AttackStrategy.Leetspeak,
    "rot13": AttackStrategy.ROT13,
    "caesar": AttackStrategy.Caesar,
    "morse": AttackStrategy.Morse,
    "flip": AttackStrategy.Flip,
    "ascii_art": AttackStrategy.AsciiArt,
    "unicode_substitution": AttackStrategy.UnicodeSubstitution,
    "suffix_append": AttackStrategy.SuffixAppend,
}


class CrucibleRedTeamAdapter:
    """Adapter around azure-ai-evaluation RedTeam. Hides all SDK-specific types."""

    def __init__(
        self,
        azure_ai_project: Any,
        credential: Any,
        categories: List[str],
        num_objectives: int = 10,
        application_scenario: Optional[str] = None,
    ) -> None:
        risk_categories = [CATEGORY_MAP[c.lower()] for c in categories]
        self._red_team = RedTeam(
            azure_ai_project=azure_ai_project,
            credential=credential,
            risk_categories=risk_categories,
            num_objectives=num_objectives,
            application_scenario=application_scenario,
        )

    async def scan(
        self,
        target: Callable,
        strategies: List[str],
        scan_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        attack_strategies = [STRATEGY_MAP[s.lower()] for s in strategies]
        result: RedTeamResult = await self._red_team.scan(
            target=target,
            attack_strategies=attack_strategies,
            scan_name=scan_name,
        )
        return self._normalize_result(result)

    def _normalize_result(self, result: RedTeamResult) -> List[Dict[str, Any]]:
        """Convert RedTeamResult to internal schema list.

        Each item has: category, strategy, prompt, response, attack_success, severity_label.
        The 'seed' field is set to the first user turn content.
        """
        if not result.attack_details:
            return []

        normalized: List[Dict[str, Any]] = []
        for detail in result.attack_details:
            conversation = detail.get("conversation", [])
            prompt = ""
            response = ""
            for i in range(len(conversation) - 1):
                msg = conversation[i]
                next_msg = conversation[i + 1]
                if msg.get("role") == "user" and next_msg.get("role") == "assistant":
                    prompt = msg.get("content", "")
                    response = next_msg.get("content", "")
                    break

            risk_assessment = detail.get("risk_assessment") or {}
            severity_label = None
            for assessment in risk_assessment.values():
                if assessment and assessment.get("severity_label"):
                    severity_label = assessment["severity_label"]
                    break

            normalized.append(
                {
                    "category": detail.get("risk_category", ""),
                    "strategy": detail.get("attack_technique", ""),
                    "prompt": prompt,
                    "seed": prompt,
                    "response": response,
                    "attack_success": detail.get("attack_success"),
                    "severity_label": severity_label,
                    "attack_complexity": detail.get("attack_complexity", ""),
                }
            )

        return normalized
