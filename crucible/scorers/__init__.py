"""Shared types for the scoring pipeline."""
from dataclasses import dataclass, field


@dataclass
class ScoreResult:
    severity: float  # 0–7 calibrated
    category: str
    scorer_type: str  # "cpp_engine" | "azure_cs" | "llm_judge"
    matched_rules: list[str] = field(default_factory=list)
    reasoning: str = ""
    raw_scores: dict[str, float] = field(default_factory=dict)


@dataclass
class FusionResult:
    composite_severity: float  # 0–7
    cpp_score: float
    azure_cs_score: float
    llm_judge_score: float
    cpp_weight: float
    azure_cs_weight: float
    llm_judge_weight: float
    kappa_cpp_azure: float | None = None
    kappa_cpp_judge: float | None = None
    kappa_azure_judge: float | None = None
