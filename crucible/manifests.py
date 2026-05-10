"""Reproducibility manifest generation for completed runs."""
import hashlib
import json
from typing import Optional

import yaml

from crucible.db.models import Manifest, Run


def generate_manifest(
    run: Run,
    scorer_versions: Optional[dict] = None,
    target_model_version: Optional[str] = None,
    attacker_model_version: Optional[str] = None,
    attack_set_version: str = "1.0.0",
) -> Manifest:
    """
    Build a reproducibility manifest for a run.
    Returns an unsaved Manifest ORM object ready to add to a session.
    The manifest_hash is SHA-256 of the canonical YAML so any parameter
    change produces a different hash.
    """
    data = {
        "run_id": run.id,
        "target_model": run.target_model,
        "target_model_version": target_model_version or run.target_model,
        "attacker_model": run.attacker_model,
        "attacker_model_version": attacker_model_version or run.attacker_model,
        "attack_set_version": attack_set_version,
        "categories": sorted(json.loads(run.categories)),
        "strategies": sorted(json.loads(run.strategies)),
        "num_objectives": run.num_objectives,
        "seed": run.seed,
        "scorer_versions": scorer_versions or {},
    }
    yaml_str = yaml.dump(data, sort_keys=True, default_flow_style=False)
    manifest_hash = hashlib.sha256(yaml_str.encode()).hexdigest()

    return Manifest(
        run_id=run.id,
        manifest_yaml=yaml_str,
        manifest_hash=manifest_hash,
        target_model_version=target_model_version or run.target_model,
        attacker_model_version=attacker_model_version or run.attacker_model,
        attack_set_version=attack_set_version,
        scorer_versions=json.dumps(scorer_versions or {}),
    )
