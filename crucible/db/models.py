"""
SQLAlchemy 2.0 ORM models for Crucible.
All seven tables: Run, Attack, Response, Score, ScoreFusion, Policy, Manifest.
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class RunStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class ScorerType(str, enum.Enum):
    cpp_engine = "cpp_engine"
    azure_cs = "azure_cs"
    llm_judge = "llm_judge"


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )
    status: Mapped[str] = mapped_column(
        Enum(RunStatus), default=RunStatus.pending, nullable=False
    )
    target_model: Mapped[str] = mapped_column(String(255), nullable=False)
    attacker_model: Mapped[str] = mapped_column(String(255), nullable=False)
    categories: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array string
    strategies: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array string
    num_objectives: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    seed: Mapped[int] = mapped_column(Integer, nullable=True)
    asr: Mapped[float] = mapped_column(Float, nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)

    attacks: Mapped[list["Attack"]] = relationship("Attack", back_populates="run")
    manifest: Mapped["Manifest"] = relationship("Manifest", back_populates="run", uselist=False)


class Attack(Base):
    __tablename__ = "attacks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("runs.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    strategy: Mapped[str] = mapped_column(String(100), nullable=False)
    attack_complexity: Mapped[str] = mapped_column(String(50), nullable=True)
    seed_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    attack_success: Mapped[bool] = mapped_column(nullable=True)

    run: Mapped["Run"] = relationship("Run", back_populates="attacks")
    response: Mapped["Response"] = relationship("Response", back_populates="attack", uselist=False)

    __table_args__ = (
        Index("ix_attacks_run_id", "run_id"),
        Index("ix_attacks_category_strategy", "run_id", "category", "strategy"),
    )


class Response(Base):
    __tablename__ = "responses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    attack_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("attacks.id"), nullable=False, unique=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    model_version: Mapped[str] = mapped_column(String(255), nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=True)

    attack: Mapped["Attack"] = relationship("Attack", back_populates="response")
    scores: Mapped[list["Score"]] = relationship("Score", back_populates="response")
    score_fusions: Mapped[list["ScoreFusion"]] = relationship(
        "ScoreFusion", back_populates="response"
    )

    __table_args__ = (Index("ix_responses_attack_id", "attack_id"),)


class Score(Base):
    __tablename__ = "scores"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    response_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("responses.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    scorer_type: Mapped[str] = mapped_column(
        Enum(ScorerType), nullable=False
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[float] = mapped_column(Float, nullable=False)
    matched_rules: Mapped[str] = mapped_column(Text, nullable=True)  # JSON list of rule IDs
    reasoning: Mapped[str] = mapped_column(Text, nullable=True)

    response: Mapped["Response"] = relationship("Response", back_populates="scores")

    __table_args__ = (
        CheckConstraint("severity >= 0 AND severity <= 7", name="ck_scores_severity_range"),
        CheckConstraint(
            "scorer_type IN ('cpp_engine', 'azure_cs', 'llm_judge')",
            name="ck_scores_scorer_type",
        ),
        # Hot-path index from PRD: queries filter by response_id, scorer_type, category
        Index("ix_scores_hot_path", "response_id", "scorer_type", "category"),
    )


class ScoreFusion(Base):
    __tablename__ = "score_fusions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    response_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("responses.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    composite_severity: Mapped[float] = mapped_column(Float, nullable=False)
    cpp_weight: Mapped[float] = mapped_column(Float, nullable=False)
    azure_cs_weight: Mapped[float] = mapped_column(Float, nullable=False)
    llm_judge_weight: Mapped[float] = mapped_column(Float, nullable=False)
    kappa_cpp_azure: Mapped[float] = mapped_column(Float, nullable=True)
    kappa_cpp_judge: Mapped[float] = mapped_column(Float, nullable=True)
    kappa_azure_judge: Mapped[float] = mapped_column(Float, nullable=True)

    response: Mapped["Response"] = relationship("Response", back_populates="score_fusions")

    __table_args__ = (
        CheckConstraint(
            "composite_severity >= 0 AND composite_severity <= 7",
            name="ck_fusions_severity_range",
        ),
        Index("ix_score_fusions_response_id", "response_id"),
    )


class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    rules_json: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)


class Manifest(Base):
    __tablename__ = "manifests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("runs.id"), nullable=False, unique=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    manifest_yaml: Mapped[str] = mapped_column(Text, nullable=False)
    manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256 hex
    target_model_version: Mapped[str] = mapped_column(String(255), nullable=True)
    attacker_model_version: Mapped[str] = mapped_column(String(255), nullable=True)
    attack_set_version: Mapped[str] = mapped_column(String(255), nullable=True)
    scorer_versions: Mapped[str] = mapped_column(Text, nullable=True)  # JSON dict

    run: Mapped["Run"] = relationship("Run", back_populates="manifest")

    __table_args__ = (Index("ix_manifests_manifest_hash", "manifest_hash"),)
