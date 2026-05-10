"""
End-to-end tests for the full scan pipeline.

Strategy: run the Celery task body synchronously (no broker/worker needed) against
an in-memory SQLite DB, then verify the API endpoints reflect the correct state.
This lets the tests run in CI without Docker or Redis.
"""
from __future__ import annotations

import hashlib
import json
import yaml
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from crucible.api.deps import get_db, verify_token
from crucible.api.main import app
from crucible.db.models import (
    Attack,
    Base,
    Manifest,
    Response,
    Run,
    RunStatus,
    Score,
    ScoreFusion,
)

# ── Shared in-memory DB ───────────────────────────────────────────────────────

_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_Session = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


def _override_get_db():
    Base.metadata.create_all(bind=_engine)
    db = _Session()
    try:
        yield db
    finally:
        db.close()


def _override_verify_token():
    return {"sub": "e2e-test"}


app.dependency_overrides[get_db] = _override_get_db
app.dependency_overrides[verify_token] = _override_verify_token

client = TestClient(app)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.drop_all(bind=_engine)
    Base.metadata.create_all(bind=_engine)
    yield


@pytest.fixture()
def task_session():
    """Session factory wired to the same in-memory DB as the API client."""
    return sessionmaker(bind=_engine)


# ── Mocked scorer responses ───────────────────────────────────────────────────

_CPP_SCORE = {"severity": 4.0, "matched_rules": ["V001", "V002"], "category_scores": {"violence": 4.0}}
_AZURE_SCORE = {"severity": 5.0}
_JUDGE_SCORE = {"severity": 4.0, "reasoning": "Response describes violence"}
_FUSION_RESULT = {
    "composite": 4.6,
    "weights": {"cpp": 0.2, "azure_cs": 0.5, "llm_judge": 0.3},
    "kappa_cpp_azure": 0.72,
    "kappa_cpp_judge": 0.68,
    "kappa_azure_judge": 0.81,
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _create_run_via_api(categories=None, strategies=None, num_objectives=2) -> str:
    """POST /runs and return the run_id without enqueueing a real Celery job."""
    categories = categories or ["violence"]
    strategies = strategies or ["easy"]
    with patch("crucible.tasks.scan_task.run_scan_task") as mock_task:
        mock_task.delay = MagicMock()
        resp = client.post(
            "/runs",
            json={
                "target_model": "phi4-mini",
                "categories": categories,
                "strategies": strategies,
                "num_objectives": num_objectives,
                "seed": 42,
            },
        )
    assert resp.status_code == 201, resp.text
    return resp.json()["run_id"]


def _run_task_synchronously(run_id: str, task_session) -> None:
    """Execute the scan task body against the shared in-memory DB (no Celery/Redis)."""
    import crucible.tasks.scan_task as st

    Session = task_session

    with (
        patch.object(st, "_SessionLocal", Session),
        patch.object(st, "_call_target_model", return_value=("Here is how to harm someone: ...", 120)),
        patch.object(st, "_publish_attack_result"),  # silence Redis calls
        patch("crucible_policy.PolicyEngine") as mock_cpp,
        patch("crucible.scorers.azure_cs_scorer.AzureContentSafetyScorer") as mock_azure,
        patch("crucible.scorers.llm_judge_scorer.LLMJudgeScorer") as mock_judge,
        patch("crucible.scorers.fusion.ScoreFusion") as mock_fusion,
    ):
        mock_cpp.return_value.score.return_value = _CPP_SCORE
        mock_azure.return_value.score.return_value = _AZURE_SCORE
        mock_judge.return_value.score.return_value = _JUDGE_SCORE
        mock_fusion.return_value.fuse.return_value = _FUSION_RESULT
        st.run_scan_task(run_id)


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_complete_scan_pipeline_with_local_llm(task_session):
    """
    Full pipeline: create run → execute task synchronously → poll API → verify results.

    Assertions from todo.md Task 8.1:
    1. At least 1 attack was generated
    2. Each attack has scores from all three scorers
    3. Composite severity is between 0 and 7
    4. matched_rules is non-empty for any severity > 2
    5. Cohen's κ values are stored (in ScoreFusion rows)
    """
    run_id = _create_run_via_api(categories=["violence"], strategies=["easy"], num_objectives=2)

    # Verify run starts as pending
    resp = client.get(f"/runs/{run_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"

    # Execute task synchronously (simulates Celery worker processing)
    _run_task_synchronously(run_id, task_session)

    # Poll the status endpoint — should now be completed
    resp = client.get(f"/runs/{run_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed", f"Unexpected status: {data['status']}"
    assert data["progress"] == 1.0

    # Fetch the full report
    report = client.get(f"/runs/{run_id}/report").json()
    attacks = report["attacks"]

    # 1. At least 1 attack generated
    assert len(attacks) >= 1, "Expected at least 1 attack"

    for attack in attacks:
        # 2. All three scorer scores present
        assert attack["cpp_score"] is not None, "cpp_score missing"
        assert attack["azure_cs_score"] is not None, "azure_cs_score missing"
        assert attack["llm_judge_score"] is not None, "llm_judge_score missing"

        # 3. Composite severity in 0–7
        composite = attack["composite_severity"]
        assert composite is not None
        assert 0.0 <= composite <= 7.0, f"Composite out of range: {composite}"

        # 4. matched_rules non-empty when severity > 2
        if composite > 2.0:
            assert len(attack["matched_rules"]) > 0, "matched_rules empty for high-severity attack"

    # 5. Cohen's κ values stored — check via DB directly
    db = _Session()
    try:
        fusions = (
            db.query(ScoreFusion)
            .join(Response, Response.id == ScoreFusion.response_id)
            .join(Attack, Attack.id == Response.attack_id)
            .filter(Attack.run_id == run_id)
            .all()
        )
        assert len(fusions) >= 1
        for fusion in fusions:
            assert fusion.kappa_cpp_azure is not None, "kappa_cpp_azure not stored"
            assert fusion.kappa_cpp_judge is not None, "kappa_cpp_judge not stored"
            assert fusion.kappa_azure_judge is not None, "kappa_azure_judge not stored"
    finally:
        db.close()


def test_websocket_streams_attack_results(task_session):
    """
    WebSocket streams at least one attack_result message during a scan.

    The handler has its own _SessionLocal; we patch it to use the test DB so the
    replay path can see the scored attacks. Redis pub/sub is also mocked so no
    real broker is needed.
    """
    import asyncio
    from unittest.mock import AsyncMock

    run_id = _create_run_via_api(categories=["violence"], strategies=["easy"], num_objectives=2)
    _run_task_synchronously(run_id, task_session)

    # Build the list of messages the WS handler's replay path will emit from the
    # real DB. We'll also feed a terminal status so the handler exits cleanly.
    db = _Session()
    try:
        fusions = (
            db.query(ScoreFusion)
            .join(Response, Response.id == ScoreFusion.response_id)
            .join(Attack, Attack.id == Response.attack_id)
            .filter(Attack.run_id == run_id)
            .all()
        )
        assert len(fusions) >= 1, "No scored attacks in DB before WebSocket test"
    finally:
        db.close()

    # Patch the websocket module's _SessionLocal to the test DB so _replay_existing
    # can see the completed run and returns early (no Redis subscribe needed).
    import crucible.api.websocket as ws_mod

    with patch.object(ws_mod, "_SessionLocal", task_session):
        received: list[dict] = []
        with client.websocket_connect(f"/runs/{run_id}/stream") as ws:
            while True:
                try:
                    msg = ws.receive_json()
                    received.append(msg)
                    if msg.get("type") == "status":
                        break
                except Exception:
                    break

    attack_messages = [m for m in received if m.get("type") == "attack_result"]
    status_messages = [m for m in received if m.get("type") == "status"]

    # At least 1 attack_result message must have arrived
    assert len(attack_messages) >= 1, f"Expected attack_result messages, got: {received}"

    # Status message should indicate completion
    assert len(status_messages) == 1
    assert status_messages[0]["status"] == "completed"

    # Each attack_result must carry required fields
    for msg in attack_messages:
        assert "attack_id" in msg
        assert "category" in msg
        assert "composite_severity" in msg
        assert 0.0 <= msg["composite_severity"] <= 7.0


def test_manifest_yaml_is_valid_and_complete(task_session):
    """
    GET /runs/{id}/manifest returns parseable YAML with all required fields.

    Since manifest generation is implemented in Phase 9, this test seeds the
    Manifest row directly (matching what Phase 9 will produce) and validates
    the endpoint + YAML schema.
    """
    run_id = _create_run_via_api(categories=["violence"], strategies=["easy"], num_objectives=1)
    _run_task_synchronously(run_id, task_session)

    # Seed the manifest row (Phase 9 will generate this automatically on run completion)
    manifest_data = {
        "target_model": "phi4-mini",
        "target_model_version": "phi4-mini:latest",
        "attacker_model": "phi4-mini",
        "attacker_model_version": "phi4-mini:latest",
        "temperature": 0.7,
        "attack_set_version": "crucible-builtin-v1",
        "scorer_versions": {
            "cpp_engine": "1.0.0",
            "azure_cs": "azure-ai-contentsafety-1.0.0",
            "llm_judge": "phi4-mini",
        },
        "seed": 42,
        "num_objectives": 1,
        "strategies": ["easy"],
        "categories": ["violence"],
    }
    manifest_yaml = yaml.dump(manifest_data, default_flow_style=False)
    manifest_hash = hashlib.sha256(manifest_yaml.encode()).hexdigest()

    db = _Session()
    try:
        manifest = Manifest(
            run_id=run_id,
            manifest_yaml=manifest_yaml,
            manifest_hash=manifest_hash,
            target_model_version="phi4-mini:latest",
            attacker_model_version="phi4-mini:latest",
            attack_set_version="crucible-builtin-v1",
            scorer_versions=json.dumps(manifest_data["scorer_versions"]),
        )
        db.add(manifest)
        db.commit()
    finally:
        db.close()

    # Fetch via API
    resp = client.get(f"/runs/{run_id}/manifest")
    assert resp.status_code == 200, resp.text
    payload = resp.json()

    # Endpoint returns required top-level keys
    assert "manifest_yaml" in payload
    assert "manifest_hash" in payload
    assert "target_model_version" in payload
    assert "attacker_model_version" in payload
    assert "attack_set_version" in payload
    assert "scorer_versions" in payload

    # Hash is a valid SHA-256 hex string (64 chars)
    assert len(payload["manifest_hash"]) == 64

    # YAML parses correctly and contains all required fields
    parsed = yaml.safe_load(payload["manifest_yaml"])
    required_fields = [
        "target_model",
        "attacker_model",
        "seed",
        "num_objectives",
        "strategies",
        "categories",
        "scorer_versions",
    ]
    for field in required_fields:
        assert field in parsed, f"Required YAML field missing: {field}"

    # scorer_versions must list all three scorer types
    sv = parsed["scorer_versions"]
    assert "cpp_engine" in sv
    assert "azure_cs" in sv
    assert "llm_judge" in sv
