"""Unit tests for crucible/manifests.py — no DB, no network."""
import hashlib
import json
import types

import yaml

from crucible.manifests import generate_manifest


def _make_run(**overrides) -> types.SimpleNamespace:
    """Build a minimal duck-type stand-in for a Run ORM object."""
    defaults = dict(
        id="run-abc-123",
        target_model="phi4-mini",
        attacker_model="phi4-mini",
        categories=json.dumps(["violence", "hate"]),
        strategies=json.dumps(["easy", "moderate"]),
        num_objectives=5,
        seed=42,
    )
    defaults.update(overrides)
    return types.SimpleNamespace(**defaults)


def test_generate_manifest_returns_manifest_object():
    run = _make_run()
    m = generate_manifest(run)
    assert m.run_id == run.id
    assert m.manifest_yaml
    assert m.manifest_hash


def test_manifest_yaml_contains_run_fields():
    run = _make_run()
    m = generate_manifest(run)
    data = yaml.safe_load(m.manifest_yaml)
    assert data["target_model"] == "phi4-mini"
    assert data["num_objectives"] == 5
    assert data["seed"] == 42
    assert sorted(data["categories"]) == ["hate", "violence"]
    assert sorted(data["strategies"]) == ["easy", "moderate"]


def test_manifest_hash_is_sha256_of_yaml():
    run = _make_run()
    m = generate_manifest(run)
    expected = hashlib.sha256(m.manifest_yaml.encode()).hexdigest()
    assert m.manifest_hash == expected


def test_manifest_hash_changes_when_params_change():
    run_a = _make_run(num_objectives=5)
    run_b = _make_run(num_objectives=10)
    m_a = generate_manifest(run_a)
    m_b = generate_manifest(run_b)
    assert m_a.manifest_hash != m_b.manifest_hash


def test_manifest_hash_changes_when_seed_changes():
    run_a = _make_run(seed=42)
    run_b = _make_run(seed=99)
    assert generate_manifest(run_a).manifest_hash != generate_manifest(run_b).manifest_hash


def test_manifest_hash_changes_when_categories_change():
    run_a = _make_run(categories=json.dumps(["violence"]))
    run_b = _make_run(categories=json.dumps(["hate"]))
    assert generate_manifest(run_a).manifest_hash != generate_manifest(run_b).manifest_hash


def test_manifest_hash_changes_when_strategies_change():
    run_a = _make_run(strategies=json.dumps(["easy"]))
    run_b = _make_run(strategies=json.dumps(["difficult"]))
    assert generate_manifest(run_a).manifest_hash != generate_manifest(run_b).manifest_hash


def test_manifest_scorer_versions_stored_as_json():
    run = _make_run()
    versions = {"cpp_engine": "2.5", "azure_cs": "1.0", "llm_judge": "1.0"}
    m = generate_manifest(run, scorer_versions=versions)
    stored = json.loads(m.scorer_versions)
    assert stored == versions


def test_manifest_scorer_versions_appear_in_yaml():
    run = _make_run()
    versions = {"cpp_engine": "2.5"}
    m = generate_manifest(run, scorer_versions=versions)
    data = yaml.safe_load(m.manifest_yaml)
    assert data["scorer_versions"] == versions


def test_manifest_attack_set_version_default():
    run = _make_run()
    m = generate_manifest(run)
    assert m.attack_set_version == "1.0.0"


def test_manifest_custom_attack_set_version():
    run = _make_run()
    m = generate_manifest(run, attack_set_version="2.3.1")
    assert m.attack_set_version == "2.3.1"
    data = yaml.safe_load(m.manifest_yaml)
    assert data["attack_set_version"] == "2.3.1"


def test_same_params_produce_same_hash():
    run = _make_run()
    assert generate_manifest(run).manifest_hash == generate_manifest(run).manifest_hash


def test_categories_sorted_in_yaml():
    """Category order in the run config should not affect the hash."""
    run_a = _make_run(categories=json.dumps(["violence", "hate"]))
    run_b = _make_run(categories=json.dumps(["hate", "violence"]))
    assert generate_manifest(run_a).manifest_hash == generate_manifest(run_b).manifest_hash
