"""
Crucible FastAPI application.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from crucible.api.routes import runs, policies
from crucible.api.websocket import router as ws_router

app = FastAPI(title="Crucible", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(runs.router)
app.include_router(policies.router)
app.include_router(ws_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
