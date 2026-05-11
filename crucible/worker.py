"""
Celery application configuration for Crucible.
Import the C++ module at module level (PRD Pitfall #8) so workers have it ready.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from celery import Celery

# Pitfall #8: import the C++ extension at module load, not inside the task.
# This ensures the .so is fully initialized before Celery forks workers.
try:
    import crucible_policy as _cpp  # noqa: F401
except ImportError:
    pass  # allow import in environments without the built .so (CI lint stage)

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")

celery_app = Celery(
    "crucible",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["crucible.tasks.scan_task"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_track_started=True,
    result_expires=3600,
)
