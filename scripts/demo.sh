#!/usr/bin/env bash
# demo.sh — one-command Crucible demo
# Usage: bash scripts/demo.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"

# ── Pre-flight checks ─────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    echo "Error: Docker not found. Install Docker Desktop and try again." >&2
    exit 1
fi

if ! docker info &>/dev/null; then
    echo "Error: Docker daemon is not running. Start Docker Desktop and try again." >&2
    exit 1
fi

# ── .env bootstrap ────────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
    echo "No .env found — copying from .env.example (fine for local demo with Ollama)"
    cp .env.example .env
fi

# ── Build and start ───────────────────────────────────────────────────────────
echo "Building and starting Crucible stack (first build compiles C++ — takes ~2 min)..."
docker-compose up --build -d

# ── Wait for API ──────────────────────────────────────────────────────────────
echo -n "Waiting for API to be ready"
for i in $(seq 1 30); do
    if curl -sf http://localhost:8000/health &>/dev/null; then
        echo " ready."
        break
    fi
    echo -n "."
    sleep 3
done

if ! curl -sf http://localhost:8000/health &>/dev/null; then
    echo ""
    echo "API did not start in time. Check logs: docker-compose logs api"
    exit 1
fi

# ── Print info ────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              Crucible is running                     ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Frontend  →  http://localhost:5173                  ║"
echo "║  API       →  http://localhost:8000                  ║"
echo "║  API docs  →  http://localhost:8000/docs             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Quick scan (requires 'ollama serve' running on host):"
echo "  curl -s -X POST http://localhost:8000/runs \\"
echo "    -H 'Authorization: Bearer dev-token' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"target_model\":\"phi4-mini\",\"categories\":[\"violence\"],\"strategies\":[\"easy\"],\"num_objectives\":2,\"seed\":42}'"
echo ""
echo "Stop everything: docker-compose down"

# ── Open browser ──────────────────────────────────────────────────────────────
if command -v open &>/dev/null; then
    open http://localhost:5173
elif command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:5173
fi
