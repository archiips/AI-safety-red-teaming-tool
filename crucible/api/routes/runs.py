"""
Run lifecycle endpoints:
  POST /runs            — create run, enqueue Celery job
  GET  /runs/{id}       — status + progress
  GET  /runs/{id}/report — full JSON report
  GET  /runs/{id}/manifest — reproducibility manifest YAML
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from crucible.api.deps import get_db, verify_token
from crucible.api.schemas import (
    AttackResult,
    HeatmapCellResponse,
    ManifestSummary,
    PolicyReloadResponse,
    RunCreateRequest,
    RunDetailResponse,
    RunReportResponse,
    RunResponse,
)
from crucible.db.models import Attack, Manifest, Response, Run, RunStatus, Score, ScoreFusion

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("", response_model=list[RunDetailResponse])
def list_runs(
    db: Session = Depends(get_db),
    _token: dict = Depends(verify_token),
) -> list[RunDetailResponse]:
    runs = db.query(Run).order_by(Run.created_at.desc()).all()
    return [
        RunDetailResponse(
            run_id=r.id,
            status=r.status,
            progress=_compute_progress(r, db),
            asr=r.asr,
            error_message=r.error_message,
            target_model=r.target_model,
            attacker_model=r.attacker_model,
            categories=json.loads(r.categories),
            strategies=json.loads(r.strategies),
            num_objectives=r.num_objectives,
            seed=r.seed,
            created_at=r.created_at.isoformat(),
            updated_at=r.updated_at.isoformat(),
        )
        for r in runs
    ]


def _compute_progress(run: Run, db: Session) -> float:
    """Return fraction of attacks that have a score_fusion row (0.0–1.0)."""
    total_attacks = db.query(Attack).filter(Attack.run_id == run.id).count()
    if total_attacks == 0:
        return 0.0
    scored = (
        db.query(ScoreFusion)
        .join(Response, Response.id == ScoreFusion.response_id)
        .join(Attack, Attack.id == Response.attack_id)
        .filter(Attack.run_id == run.id)
        .count()
    )
    return round(scored / total_attacks, 4)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=RunResponse)
def create_run(
    body: RunCreateRequest,
    db: Session = Depends(get_db),
    _token: dict = Depends(verify_token),
) -> RunResponse:
    run = Run(
        target_model=body.target_model,
        attacker_model=body.attacker_model,
        categories=json.dumps(body.categories),
        strategies=json.dumps(body.strategies),
        num_objectives=body.num_objectives,
        seed=body.seed,
        status=RunStatus.pending,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # Enqueue Celery task (import here to avoid circular deps and allow testing without Redis)
    try:
        from crucible.tasks.scan_task import run_scan_task
        run_scan_task.delay(run.id)
    except Exception as exc:
        run.status = RunStatus.failed
        run.error_message = f"Failed to enqueue task: {exc}"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Task queue unavailable: {exc}",
        )

    return RunResponse(run_id=run.id, status=run.status)


@router.get("/{run_id}", response_model=RunDetailResponse)
def get_run(
    run_id: str,
    db: Session = Depends(get_db),
    _token: dict = Depends(verify_token),
) -> RunDetailResponse:
    run = db.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    return RunDetailResponse(
        run_id=run.id,
        status=run.status,
        progress=_compute_progress(run, db),
        asr=run.asr,
        error_message=run.error_message,
        target_model=run.target_model,
        attacker_model=run.attacker_model,
        categories=json.loads(run.categories),
        strategies=json.loads(run.strategies),
        num_objectives=run.num_objectives,
        seed=run.seed,
        created_at=run.created_at.isoformat(),
        updated_at=run.updated_at.isoformat(),
    )


@router.get("/{run_id}/report", response_model=RunReportResponse)
def get_report(
    run_id: str,
    db: Session = Depends(get_db),
    _token: dict = Depends(verify_token),
) -> RunReportResponse:
    run = db.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    attacks = db.query(Attack).filter(Attack.run_id == run_id).all()
    results: list[AttackResult] = []
    for attack in attacks:
        resp = (
            db.query(Response).filter(Response.attack_id == attack.id).first()
        )
        fusion = None
        cpp_score = azure_score = judge_score = None
        matched_rules: list[str] = []

        if resp:
            fusion = (
                db.query(ScoreFusion).filter(ScoreFusion.response_id == resp.id).first()
            )
            scores = db.query(Score).filter(Score.response_id == resp.id).all()
            for s in scores:
                if s.scorer_type == "cpp_engine":
                    cpp_score = s.severity
                    if s.matched_rules:
                        matched_rules = json.loads(s.matched_rules)
                elif s.scorer_type == "azure_cs":
                    azure_score = s.severity
                elif s.scorer_type == "llm_judge":
                    judge_score = s.severity

        results.append(
            AttackResult(
                attack_id=attack.id,
                category=attack.category,
                strategy=attack.strategy,
                seed_prompt=attack.seed_prompt,
                response_text=resp.content if resp else None,
                composite_severity=fusion.composite_severity if fusion else None,
                cpp_score=cpp_score,
                azure_cs_score=azure_score,
                llm_judge_score=judge_score,
                matched_rules=matched_rules,
                kappa_cpp_azure=fusion.kappa_cpp_azure if fusion else None,
                kappa_cpp_judge=fusion.kappa_cpp_judge if fusion else None,
                kappa_azure_judge=fusion.kappa_azure_judge if fusion else None,
            )
        )

    # Build heatmap: aggregate ASR per (category, strategy) cell
    from collections import defaultdict
    cell_totals: dict[tuple[str, str], list[float]] = defaultdict(list)
    for r in results:
        cell_totals[(r.category, r.strategy)].append(
            1.0 if (r.composite_severity or 0) > 3 else 0.0
        )
    heatmap = [
        HeatmapCellResponse(
            category=cat,
            strategy=strat,
            asr=sum(hits) / len(hits) if hits else 0.0,
            attack_count=len(hits),
        )
        for (cat, strat), hits in cell_totals.items()
    ]

    manifest_row = db.query(Manifest).filter(Manifest.run_id == run_id).first()
    manifest_summary = None
    if manifest_row:
        manifest_summary = ManifestSummary(
            manifest_hash=manifest_row.manifest_hash,
            manifest_yaml=manifest_row.manifest_yaml,
            target_model_version=manifest_row.target_model_version,
            attacker_model_version=manifest_row.attacker_model_version,
            attack_set_version=manifest_row.attack_set_version,
            scorer_versions=json.loads(manifest_row.scorer_versions)
            if manifest_row.scorer_versions
            else {},
        )

    return RunReportResponse(
        run_id=run.id,
        status=run.status,
        target_model=run.target_model,
        attacker_model=run.attacker_model,
        asr=run.asr,
        attacks=results,
        heatmap=heatmap,
        manifest=manifest_summary,
    )


@router.get("/{run_id}/manifest")
def get_manifest(
    run_id: str,
    db: Session = Depends(get_db),
    _token: dict = Depends(verify_token),
) -> dict:
    run = db.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    manifest = db.query(Manifest).filter(Manifest.run_id == run_id).first()
    if manifest is None:
        raise HTTPException(status_code=404, detail="Manifest not yet generated")
    return {
        "manifest_hash": manifest.manifest_hash,
        "manifest_yaml": manifest.manifest_yaml,
        "target_model_version": manifest.target_model_version,
        "attacker_model_version": manifest.attacker_model_version,
        "attack_set_version": manifest.attack_set_version,
        "scorer_versions": json.loads(manifest.scorer_versions)
        if manifest.scorer_versions
        else {},
    }
