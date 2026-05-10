"""
Pydantic request/response schemas for the Crucible API.
"""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class RunCreateRequest(BaseModel):
    target_model: str = Field(..., min_length=1)
    attacker_model: str = Field(default="phi4-mini")
    categories: list[str] = Field(..., min_length=1)
    strategies: list[str] = Field(..., min_length=1)
    num_objectives: int = Field(default=10, ge=1, le=20)
    seed: Optional[int] = None

    @field_validator("categories")
    @classmethod
    def validate_categories(cls, v: list[str]) -> list[str]:
        valid = {
            "violence", "hate", "sexual", "self_harm", "cybercrime",
            "bioweapons", "chemical", "nuclear", "radicalization", "privacy",
        }
        for cat in v:
            if cat not in valid:
                raise ValueError(f"Unknown category: {cat}. Valid: {sorted(valid)}")
        return v

    @field_validator("strategies")
    @classmethod
    def validate_strategies(cls, v: list[str]) -> list[str]:
        valid = {"easy", "moderate", "difficult"}
        for s in v:
            if s not in valid:
                raise ValueError(f"Unknown strategy: {s}. Valid: {sorted(valid)}")
        return v


class RunResponse(BaseModel):
    run_id: str
    status: str
    progress: float = 0.0
    asr: Optional[float] = None
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}


class RunDetailResponse(RunResponse):
    target_model: str
    attacker_model: str
    categories: list[str]
    strategies: list[str]
    num_objectives: int
    seed: Optional[int]
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class AttackResult(BaseModel):
    attack_id: str
    category: str
    strategy: str
    seed_prompt: str
    response_text: Optional[str]
    composite_severity: Optional[float]
    cpp_score: Optional[float]
    azure_cs_score: Optional[float]
    llm_judge_score: Optional[float]
    matched_rules: list[str]
    kappa_cpp_azure: Optional[float] = None
    kappa_cpp_judge: Optional[float] = None
    kappa_azure_judge: Optional[float] = None


class ManifestSummary(BaseModel):
    manifest_hash: str
    manifest_yaml: str
    target_model_version: Optional[str] = None
    attacker_model_version: Optional[str] = None
    attack_set_version: Optional[str] = None
    scorer_versions: dict[str, Any] = {}


class HeatmapCellResponse(BaseModel):
    category: str
    strategy: str
    asr: float
    attack_count: int


class RunReportResponse(BaseModel):
    run_id: str
    status: str
    target_model: str
    attacker_model: str
    asr: Optional[float]
    attacks: list[AttackResult]
    heatmap: list[HeatmapCellResponse] = []
    manifest: Optional[ManifestSummary] = None


class PolicyReloadResponse(BaseModel):
    status: str
    message: str
