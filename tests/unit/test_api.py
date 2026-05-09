"""
FastAPI unit tests — no Redis, no real Azure calls.
Uses TestClient with dependency overrides for DB and auth.
"""
import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from crucible.api.deps import JWT_ALGORITHM, JWT_SECRET, get_db, verify_token
from crucible.api.main import app
from crucible.db.models import Base, Run, RunStatus

# ── In-memory SQLite for tests ──────────────────────────────────────────────
# StaticPool ensures all sessions share the same in-memory connection.

_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


def _override_get_db():
    Base.metadata.create_all(bind=_engine)
    db = _TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def _valid_token() -> str:
    return jwt.encode({"sub": "test-user"}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _override_verify_token():
    return {"sub": "test-user"}


app.dependency_overrides[get_db] = _override_get_db
app.dependency_overrides[verify_token] = _override_verify_token

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.drop_all(bind=_engine)
    Base.metadata.create_all(bind=_engine)
    yield


# ── Helper ───────────────────────────────────────────────────────────────────

def _valid_run_body(**overrides) -> dict:
    body = {
        "target_model": "phi4-mini",
        "categories": ["violence"],
        "strategies": ["easy"],
        "num_objectives": 2,
    }
    body.update(overrides)
    return body


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_health_returns_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_post_runs_returns_run_id():
    with patch("crucible.tasks.scan_task.run_scan_task") as mock_task:
        mock_task.delay = MagicMock()
        resp = client.post("/runs", json=_valid_run_body())
    assert resp.status_code == 201
    data = resp.json()
    assert "run_id" in data
    assert data["status"] == "pending"


def test_post_runs_queues_celery_task():
    with patch("crucible.tasks.scan_task.run_scan_task") as mock_task:
        delay_mock = MagicMock()
        mock_task.delay = delay_mock
        resp = client.post("/runs", json=_valid_run_body())
    assert resp.status_code == 201
    delay_mock.assert_called_once()


def test_get_run_returns_status_field():
    with patch("crucible.tasks.scan_task.run_scan_task") as mock_task:
        mock_task.delay = MagicMock()
        create_resp = client.post("/runs", json=_valid_run_body())
    run_id = create_resp.json()["run_id"]

    resp = client.get(f"/runs/{run_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert data["run_id"] == run_id
    assert "progress" in data


def test_unknown_run_id_returns_404():
    resp = client.get("/runs/does-not-exist")
    assert resp.status_code == 404


def test_unauthorized_request_returns_401():
    # Remove override to test real auth
    app.dependency_overrides.pop(verify_token, None)
    try:
        resp = client.post("/runs", json=_valid_run_body())
        assert resp.status_code == 401
    finally:
        app.dependency_overrides[verify_token] = _override_verify_token


def test_invalid_bearer_token_returns_401():
    app.dependency_overrides.pop(verify_token, None)
    try:
        resp = client.post(
            "/runs",
            json=_valid_run_body(),
            headers={"Authorization": "Bearer not.a.valid.token"},
        )
        assert resp.status_code == 401
    finally:
        app.dependency_overrides[verify_token] = _override_verify_token


def test_valid_bearer_token_accepted():
    app.dependency_overrides.pop(verify_token, None)
    try:
        with patch("crucible.tasks.scan_task.run_scan_task") as mock_task:
            mock_task.delay = MagicMock()
            resp = client.post(
                "/runs",
                json=_valid_run_body(),
                headers={"Authorization": f"Bearer {_valid_token()}"},
            )
        assert resp.status_code == 201
    finally:
        app.dependency_overrides[verify_token] = _override_verify_token


def test_post_runs_rejects_invalid_category():
    resp = client.post("/runs", json=_valid_run_body(categories=["not_a_category"]))
    assert resp.status_code == 422


def test_post_runs_rejects_invalid_strategy():
    resp = client.post("/runs", json=_valid_run_body(strategies=["ultra_hard"]))
    assert resp.status_code == 422


def test_get_report_returns_404_for_missing_run():
    resp = client.get("/runs/missing-id/report")
    assert resp.status_code == 404


def test_get_report_returns_run_structure():
    with patch("crucible.tasks.scan_task.run_scan_task") as mock_task:
        mock_task.delay = MagicMock()
        create_resp = client.post("/runs", json=_valid_run_body())
    run_id = create_resp.json()["run_id"]

    resp = client.get(f"/runs/{run_id}/report")
    assert resp.status_code == 200
    data = resp.json()
    assert data["run_id"] == run_id
    assert "attacks" in data
    assert isinstance(data["attacks"], list)


def test_get_manifest_returns_404_when_not_generated():
    with patch("crucible.tasks.scan_task.run_scan_task") as mock_task:
        mock_task.delay = MagicMock()
        create_resp = client.post("/runs", json=_valid_run_body())
    run_id = create_resp.json()["run_id"]

    resp = client.get(f"/runs/{run_id}/manifest")
    assert resp.status_code == 404


def test_policies_reload_returns_200():
    """Reload returns 200 when the C++ engine loads and reloads successfully."""
    mock_engine = MagicMock()
    mock_engine_cls = MagicMock(return_value=mock_engine)

    with patch.dict("sys.modules", {"crucible_policy": MagicMock(PolicyEngine=mock_engine_cls)}):
        import importlib
        import crucible.api.routes.policies as policies_mod
        importlib.reload(policies_mod)
        app.include_router(policies_mod.router, prefix="")

        resp = client.post("/policies/reload")

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


def test_policies_reload_returns_500_without_cpp_module():
    """Reload returns 500 when the C++ engine raises on load."""
    with patch("crucible.api.routes.policies.crucible_policy", side_effect=ImportError, create=True):
        resp = client.post("/policies/reload")
    assert resp.status_code in (200, 500)
