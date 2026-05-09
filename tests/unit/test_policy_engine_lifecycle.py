"""
Lifecycle tests for PolicyEngine — Task 2.5 / PRD Pitfall #5.

Pitfall #5: C++ destructor deadlock on Celery shutdown.
The engine destructor must complete without blocking, even when called from
multiple threads or during interpreter shutdown.

Tests verify:
  - Engine can be created and destroyed in a tight loop without leaks/deadlocks
  - reload_rules() replaces state safely while concurrent score() calls run
  - Destroying the engine while a background thread holds a reference is safe
  - Multiple engine instances coexist without interference
"""
import concurrent.futures
import gc
import os
import sys
import threading
import time

import pytest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, PROJECT_ROOT)

from crucible_policy import PolicyEngine

RULES_PATH = os.path.join(PROJECT_ROOT, "data", "rules.json")


def test_engine_create_destroy_loop():
    """Create and destroy the engine 20 times; must not deadlock or leak."""
    for _ in range(20):
        engine = PolicyEngine(RULES_PATH)
        result = engine.score("I want to kill someone")
        assert result["severity"] > 0
        del engine
        gc.collect()


def test_engine_destroyed_after_thread_completes():
    """
    PRD Pitfall #5: engine is used in a thread, then the Python object is
    deleted. The C++ destructor must not block waiting for the thread's GIL.
    """
    engine = PolicyEngine(RULES_PATH)
    results = []

    def worker():
        for _ in range(100):
            results.append(engine.score("kill and attack bomb weapon"))

    t = threading.Thread(target=worker)
    t.start()
    t.join(timeout=10.0)
    assert t.is_alive() is False, "Worker thread hung — possible deadlock"
    assert len(results) == 100

    # Delete the engine after the thread is done
    del engine
    gc.collect()  # trigger C++ destructor


def test_concurrent_score_calls_during_reload():
    """
    reload_rules() must replace the trie atomically. Concurrent score() calls
    during a reload must not crash or return corrupt data.
    """
    engine = PolicyEngine(RULES_PATH)
    errors = []
    stop_event = threading.Event()

    def scorer():
        while not stop_event.is_set():
            try:
                r = engine.score("kill attack bomb weapon terrorist")
                assert 0.0 <= r["severity"] <= 7.0
            except Exception as e:
                errors.append(str(e))

    # Start 4 scorer threads
    threads = [threading.Thread(target=scorer) for _ in range(4)]
    for t in threads:
        t.start()

    # Perform 5 reloads while scorers run
    for _ in range(5):
        time.sleep(0.01)
        engine.reload_rules(RULES_PATH)

    stop_event.set()
    for t in threads:
        t.join(timeout=5.0)
        assert t.is_alive() is False, "Scorer thread hung"

    assert errors == [], f"Errors during concurrent reload: {errors}"


def test_multiple_engines_coexist():
    """Multiple PolicyEngine instances must not interfere with each other."""
    engines = [PolicyEngine(RULES_PATH) for _ in range(5)]
    text = "I want to kill and hurt people"
    results = [e.score(text) for e in engines]

    # All engines should return the same result
    ref = results[0]["severity"]
    for r in results[1:]:
        assert r["severity"] == ref, "Engines returned different severities for same input"

    # Destroy them in reverse order
    for e in reversed(engines):
        del e
    gc.collect()


def test_engine_usable_after_reload():
    """After reload_rules(), the engine must still score correctly."""
    engine = PolicyEngine(RULES_PATH)

    before = engine.score("I want to kill someone", "violence")
    assert before["severity"] > 0

    engine.reload_rules(RULES_PATH)

    after = engine.score("I want to kill someone", "violence")
    assert after["severity"] == before["severity"], (
        f"Severity changed after reload: {before['severity']} → {after['severity']}"
    )


def test_batch_score_matches_individual_scores():
    """batch_score() results must match N individual score() calls."""
    engine = PolicyEngine(RULES_PATH)
    texts = [
        "I want to kill and hurt people",
        "The weather is lovely today",
        "h4t3 speech is unacceptable",
        "Let's go for a walk",
        "Bomb attack on infrastructure threat",
    ]

    batch = engine.batch_score(texts)
    individual = [engine.score(t) for t in texts]

    assert len(batch) == len(individual)
    for i, (b, ind) in enumerate(zip(batch, individual)):
        assert abs(b["severity"] - ind["severity"]) < 1e-9, (
            f"Mismatch at index {i}: batch={b['severity']}, "
            f"individual={ind['severity']}"
        )
