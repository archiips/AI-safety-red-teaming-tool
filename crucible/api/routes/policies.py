"""
Policy management endpoints:
  POST /policies/reload — hot-reload C++ engine rules from disk
"""
import os

from fastapi import APIRouter, Depends, HTTPException, status

from crucible.api.deps import verify_token
from crucible.api.schemas import PolicyReloadResponse

router = APIRouter(prefix="/policies", tags=["policies"])

_RULES_PATH = os.environ.get("CRUCIBLE_RULES_PATH", "data/rules.json")


@router.post("/reload", response_model=PolicyReloadResponse)
def reload_policies(_token: dict = Depends(verify_token)) -> PolicyReloadResponse:
    try:
        import crucible_policy

        engine = crucible_policy.PolicyEngine(_RULES_PATH)
        engine.reload_rules(_RULES_PATH)
        return PolicyReloadResponse(status="ok", message=f"Rules reloaded from {_RULES_PATH}")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reload failed: {exc}",
        )
