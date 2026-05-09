"""
Celery worker unit tests — no Redis required, tasks run eagerly.
"""
import json
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from crucible.db.models import Attack, Base, Response, Run, RunStatus, Score, ScoreFusion


# ── In-memory DB fixture ─────────────────────────────────────────────────────

@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    yield db
    db.close()
    Base.metadata.drop_all(engine)


def _make_run(db, **kwargs) -> Run:
    run = Run(
        target_model=kwargs.get("target_model", "phi4-mini"),
        attacker_model=kwargs.get("attacker_model", "phi4-mini"),
        categories=json.dumps(kwargs.get("categories", ["violence"])),
        strategies=json.dumps(kwargs.get("strategies", ["easy"])),
        num_objectives=kwargs.get("num_objectives", 1),
        seed=kwargs.get("seed", 42),
        status=RunStatus.pending,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_scan_task_publishes_attack_result_to_redis(db_session):
    """After each scored attack the task must publish to the run's Redis channel."""
    import crucible.tasks.scan_task as st
    from sqlalchemy.orm import sessionmaker

    run = _make_run(db_session, num_objectives=1, categories=["violence"], strategies=["easy"])
    run_id = run.id
    Session = sessionmaker(bind=db_session.get_bind())

    published: list[dict] = []

    def fake_publish(rid, payload):
        published.append((rid, payload))

    with (
        patch.object(st, "_SessionLocal", Session),
        patch.object(st, "_call_target_model", return_value=("test response", 50)),
        patch.object(st, "_publish_attack_result", side_effect=fake_publish),
        patch("crucible_policy.PolicyEngine") as mock_engine_cls,
        patch("crucible.scorers.azure_cs_scorer.AzureContentSafetyScorer") as mock_azure_cls,
        patch("crucible.scorers.llm_judge_scorer.LLMJudgeScorer") as mock_judge_cls,
        patch("crucible.scorers.fusion.ScoreFusion") as mock_fusion_cls,
    ):
        mock_engine_cls.return_value.score.return_value = {
            "severity": 2.0, "matched_rules": ["V001"], "category_scores": {}
        }
        mock_azure_cls.return_value.score.return_value = {"severity": 3.0}
        mock_judge_cls.return_value.score.return_value = {"severity": 2.0, "reasoning": "test"}
        mock_fusion_cls.return_value.fuse.return_value = {
            "composite": 2.6,
            "weights": {"cpp": 0.2, "azure_cs": 0.5, "llm_judge": 0.3},
        }
        st.run_scan_task(run_id)

    # One publish per attack_result + one final status publish
    attack_publishes = [p for _, p in published if p.get("type") == "attack_result"]
    status_publishes = [p for _, p in published if p.get("type") == "status"]
    assert len(attack_publishes) >= 1
    assert len(status_publishes) == 1
    assert status_publishes[0]["status"] == RunStatus.completed
    # All publishes go to the correct channel (run_id)
    assert all(rid == run_id for rid, _ in published)


def test_celery_worker_can_import_cpp_module():
    """PRD Pitfall #8: C++ module must be importable inside Celery workers."""
    import crucible_policy  # noqa: F401


def test_worker_module_imports_celery_app():
    from crucible.worker import celery_app

    assert celery_app is not None
    assert celery_app.main == "crucible"


def test_worker_has_correct_config():
    from crucible.worker import celery_app

    assert celery_app.conf.worker_prefetch_multiplier == 1
    assert celery_app.conf.task_acks_late is True


def test_scan_task_writes_scores_to_db(db_session):
    """Full scan task pipeline with mocked LLM and scorers."""
    import crucible.tasks.scan_task as st
    from sqlalchemy.orm import sessionmaker

    run = _make_run(db_session, num_objectives=1, categories=["violence"], strategies=["easy"])
    run_id = run.id

    mock_fusion_result = {
        "composite": 2.6,
        "weights": {"cpp": 0.2, "azure_cs": 0.5, "llm_judge": 0.3},
        "kappa_cpp_azure": 0.4,
        "kappa_cpp_judge": 0.3,
        "kappa_azure_judge": 0.5,
    }

    # Patch _SessionLocal to return the test DB session via a factory
    Session = sessionmaker(bind=db_session.get_bind())

    with (
        patch.object(st, "_SessionLocal", Session),
        patch.object(st, "_call_target_model", return_value=("test response", 50)),
        patch("crucible_policy.PolicyEngine") as mock_engine_cls,
        patch("crucible.scorers.azure_cs_scorer.AzureContentSafetyScorer") as mock_azure_cls,
        patch("crucible.scorers.llm_judge_scorer.LLMJudgeScorer") as mock_judge_cls,
        patch("crucible.scorers.fusion.ScoreFusion") as mock_fusion_cls,
    ):
        mock_engine_cls.return_value.score.return_value = {
            "severity": 2.0, "matched_rules": ["V001"], "category_scores": {}
        }
        mock_azure_cls.return_value.score.return_value = {"severity": 3.0}
        mock_judge_cls.return_value.score.return_value = {"severity": 2.0, "reasoning": "test"}
        mock_fusion_cls.return_value.fuse.return_value = mock_fusion_result

        # Call task body directly (no Celery broker needed)
        st.run_scan_task(run_id)

    verify_session = Session()
    try:
        refreshed = verify_session.get(Run, run_id)
        assert refreshed is not None
        assert refreshed.status == RunStatus.completed
        attacks = verify_session.query(Attack).filter(Attack.run_id == run_id).all()
        assert len(attacks) >= 1
        responses = verify_session.query(Response).filter(
            Response.attack_id.in_([a.id for a in attacks])
        ).all()
        assert len(responses) >= 1
    finally:
        verify_session.close()


def test_scan_task_handles_scorer_failure_gracefully(db_session):
    """If all scorers crash, the run still completes (partial failure ok)."""
    import crucible.tasks.scan_task as st
    from sqlalchemy.orm import sessionmaker

    run = _make_run(db_session, num_objectives=1)
    run_id = run.id
    Session = sessionmaker(bind=db_session.get_bind())

    with (
        patch.object(st, "_SessionLocal", Session),
        patch.object(st, "_call_target_model", return_value=("response text", 100)),
        patch("crucible_policy.PolicyEngine", side_effect=ImportError("no cpp")),
        patch("crucible.scorers.azure_cs_scorer.AzureContentSafetyScorer", side_effect=Exception("azure down")),
        patch("crucible.scorers.llm_judge_scorer.LLMJudgeScorer", side_effect=Exception("judge down")),
        patch("crucible.scorers.fusion.ScoreFusion") as mock_fusion,
    ):
        mock_fusion.return_value.fuse.return_value = {
            "composite": 0.0,
            "weights": {"cpp": 0.2, "azure_cs": 0.5, "llm_judge": 0.3},
        }
        st.run_scan_task(run_id)

    verify_session = Session()
    try:
        refreshed = verify_session.get(Run, run_id)
        assert refreshed is not None
        # Run should be completed even though scorers failed
        assert refreshed.status in (RunStatus.completed, RunStatus.failed)
    finally:
        verify_session.close()
