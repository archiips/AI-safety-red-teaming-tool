"""Unit tests for SQLAlchemy models — uses in-memory SQLite, no file I/O."""
import json
import sqlite3

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from crucible.db.models import (
    Attack,
    Base,
    Manifest,
    Policy,
    Response,
    Run,
    RunStatus,
    Score,
    ScoreFusion,
    ScorerType,
)


@pytest.fixture(scope="function")
def engine():
    eng = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture(scope="function")
def session(engine):
    with Session(engine) as s:
        yield s


def _make_run(session: Session, **kwargs) -> Run:
    defaults = dict(
        target_model="phi-4-mini",
        attacker_model="phi-4-mini",
        categories=json.dumps(["violence"]),
        strategies=json.dumps(["easy"]),
    )
    defaults.update(kwargs)
    run = Run(**defaults)
    session.add(run)
    session.flush()
    return run


def _make_attack(session: Session, run: Run, **kwargs) -> Attack:
    defaults = dict(
        run_id=run.id,
        category="violence",
        strategy="jailbreak",
        seed_prompt="test prompt",
    )
    defaults.update(kwargs)
    attack = Attack(**defaults)
    session.add(attack)
    session.flush()
    return attack


def _make_response(session: Session, attack: Attack, **kwargs) -> Response:
    defaults = dict(attack_id=attack.id, content="model response text")
    defaults.update(kwargs)
    resp = Response(**defaults)
    session.add(resp)
    session.flush()
    return resp


# --- Run model tests ---

def test_run_model_creates_with_required_fields(session):
    run = _make_run(session)
    assert run.id is not None
    assert run.status == RunStatus.pending
    assert run.target_model == "phi-4-mini"
    assert run.created_at is not None


def test_run_model_default_status_is_pending(session):
    run = _make_run(session)
    assert run.status == RunStatus.pending


def test_run_model_status_can_be_updated(session):
    run = _make_run(session)
    run.status = RunStatus.completed
    session.flush()
    assert run.status == RunStatus.completed


# --- Attack model tests ---

def test_attack_model_foreign_key_to_run(session):
    run = _make_run(session)
    attack = _make_attack(session, run)
    assert attack.run_id == run.id
    assert attack.run is run


def test_attack_model_creates_with_required_fields(session):
    run = _make_run(session)
    attack = _make_attack(session, run)
    assert attack.id is not None
    assert attack.category == "violence"
    assert attack.strategy == "jailbreak"


# --- Score model tests ---

def test_score_model_scorer_type_constraint(session):
    run = _make_run(session)
    attack = _make_attack(session, run)
    resp = _make_response(session, attack)

    score = Score(
        response_id=resp.id,
        scorer_type=ScorerType.cpp_engine,
        category="violence",
        severity=3.5,
    )
    session.add(score)
    session.commit()
    assert score.scorer_type == ScorerType.cpp_engine


def test_score_model_all_three_scorer_types_valid(session):
    run = _make_run(session)
    attack = _make_attack(session, run)
    resp = _make_response(session, attack)

    for scorer_type in [ScorerType.cpp_engine, ScorerType.azure_cs, ScorerType.llm_judge]:
        score = Score(
            response_id=resp.id,
            scorer_type=scorer_type,
            category="violence",
            severity=1.0,
        )
        session.add(score)

    session.commit()
    scores = session.query(Score).filter_by(response_id=resp.id).all()
    assert len(scores) == 3


# --- Hot-path index test ---

def test_hot_path_index_exists(engine):
    insp = inspect(engine)
    indexes = insp.get_indexes("scores")
    index_names = {idx["name"] for idx in indexes}
    assert "ix_scores_hot_path" in index_names


def test_attacks_run_id_index_exists(engine):
    insp = inspect(engine)
    indexes = insp.get_indexes("attacks")
    index_names = {idx["name"] for idx in indexes}
    assert "ix_attacks_run_id" in index_names


def test_manifests_hash_index_exists(engine):
    insp = inspect(engine)
    indexes = insp.get_indexes("manifests")
    index_names = {idx["name"] for idx in indexes}
    assert "ix_manifests_manifest_hash" in index_names


# --- Manifest model tests ---

def test_manifest_model_links_to_run(session):
    run = _make_run(session)
    manifest = Manifest(
        run_id=run.id,
        manifest_yaml="run_id: test",
        manifest_hash="abc123",
    )
    session.add(manifest)
    session.flush()
    assert manifest.run is run


# --- Policy model tests ---

def test_policy_model_creates_with_required_fields(session):
    policy = Policy(name="default", rules_json=json.dumps({"rules": []}))
    session.add(policy)
    session.commit()
    assert policy.id is not None
    assert policy.is_active is True
    assert policy.version == 1


# --- ScoreFusion model tests ---

def test_score_fusion_links_to_response(session):
    run = _make_run(session)
    attack = _make_attack(session, run)
    resp = _make_response(session, attack)

    fusion = ScoreFusion(
        response_id=resp.id,
        composite_severity=2.5,
        cpp_weight=0.2,
        azure_cs_weight=0.5,
        llm_judge_weight=0.3,
    )
    session.add(fusion)
    session.flush()
    assert fusion.response is resp


# --- Relationship cascade test ---

def test_run_has_attacks_relationship(session):
    run = _make_run(session)
    _make_attack(session, run, category="violence")
    _make_attack(session, run, category="hate")
    session.flush()
    assert len(run.attacks) == 2
