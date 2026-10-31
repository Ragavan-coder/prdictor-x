"""
PREDICTRA-X FDR Lifecycle Monitoring API Routes
"""
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from auth import AuthenticatedUser, get_current_user
from lifecycle.lifecycle_service import lifecycle_service

logger = logging.getLogger("predictra.routes.lifecycle")

router = APIRouter(prefix="/api/lifecycle", tags=["FDR Lifecycle Monitoring"])


class RenewalRequest(BaseModel):
    action_type: str  # "RENEWED", "REPLACED", "CLOSED"
    new_maturity_date: Optional[str] = None
    new_principal: Optional[float] = None
    notes: Optional[str] = "Routine lifecycle update"


@router.get("", summary="Get portfolio lifecycle overview, upcoming maturities, and countdowns")
def get_lifecycle_summary(
    user: AuthenticatedUser = Depends(get_current_user),
):
    return lifecycle_service.get_lifecycle_overview()


@router.get("/calendar", summary="Get maturity calendar events grouped by date")
def get_calendar_events(
    year: Optional[int] = Query(None),
    user: AuthenticatedUser = Depends(get_current_user),
):
    events = lifecycle_service.get_calendar_events(year=year)
    return {"count": len(events), "events": events}


@router.post("/{fdr_id}/renewal", summary="Record FDR renewal, replacement, or closure lifecycle action")
def record_lifecycle_action(
    fdr_id: str,
    req: RenewalRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        return lifecycle_service.record_renewal_or_action(
            fdr_id=fdr_id,
            action_type=req.action_type,
            new_maturity_date=req.new_maturity_date,
            new_principal=req.new_principal,
            operator_username=user.username,
            notes=req.notes or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed updating lifecycle: {e}")
