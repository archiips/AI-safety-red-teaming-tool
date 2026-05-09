"""
WebSocket endpoint: WS /runs/{run_id}/stream

Protocol:
  1. On connect, immediately replay any attacks already scored (handles late connects
     and page refreshes mid-run).
  2. Subscribe to the Redis pub/sub channel `run:{run_id}:stream` and forward each
     message to the client as it arrives — no polling.
  3. Close when the run reaches a terminal status (completed/failed) or the client
     disconnects.
"""
import json
import os

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from crucible.db.models import Attack, Response, Run, RunStatus, ScoreFusion

router = APIRouter()

_DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./crucible.db")
_REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
_connect_args = {"check_same_thread": False} if _DATABASE_URL.startswith("sqlite") else {}
_engine = create_engine(_DATABASE_URL, connect_args=_connect_args)
_SessionLocal = sessionmaker(bind=_engine)

_TERMINAL = {RunStatus.completed, RunStatus.failed}


def _replay_existing(run_id: str) -> list[dict]:
    """Return scored attacks already in the DB so late-connecting clients catch up."""
    db = _SessionLocal()
    try:
        run = db.get(Run, run_id)
        if run is None:
            return [{"error": "Run not found"}]

        fusions = (
            db.query(ScoreFusion)
            .join(Response, Response.id == ScoreFusion.response_id)
            .join(Attack, Attack.id == Response.attack_id)
            .filter(Attack.run_id == run_id)
            .all()
        )
        messages = []
        for fusion in fusions:
            resp = db.get(Response, fusion.response_id)
            attack = db.get(Attack, resp.attack_id) if resp else None
            messages.append({
                "type": "attack_result",
                "attack_id": attack.id if attack else None,
                "category": attack.category if attack else None,
                "strategy": attack.strategy if attack else None,
                "composite_severity": fusion.composite_severity,
            })

        # If already terminal, include a status message so client can close cleanly
        if run.status in _TERMINAL:
            messages.append({"type": "status", "status": run.status, "asr": run.asr})

        return messages
    finally:
        db.close()


@router.websocket("/runs/{run_id}/stream")
async def stream_run(websocket: WebSocket, run_id: str) -> None:
    await websocket.accept()

    # Replay existing results before subscribing (handles late connects)
    for msg in _replay_existing(run_id):
        await websocket.send_json(msg)
        if msg.get("type") == "status" and msg.get("status") in _TERMINAL:
            return  # run already done, nothing to subscribe to

    r = aioredis.from_url(_REDIS_URL)
    pubsub = r.pubsub()
    await pubsub.subscribe(f"run:{run_id}:stream")

    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            data = json.loads(message["data"])
            await websocket.send_json(data)
            if data.get("type") == "status" and data.get("status") in _TERMINAL:
                break
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(f"run:{run_id}:stream")
        await r.aclose()
