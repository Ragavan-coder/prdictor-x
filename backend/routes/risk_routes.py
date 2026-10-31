"""
PREDICTRA-X Risk Intelligence API Routes
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from auth import AuthenticatedUser, get_current_user
from risk.risk_engine import risk_engine

logger = logging.getLogger("predictra.routes.risk")

router = APIRouter(prefix="/api/risk", tags=["Risk Intelligence"])


@router.get("/{fdr_id}", summary="Get transparent risk decision and factor breakdown for FDR")
def get_fdr_risk_assessment(
    fdr_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        return risk_engine.evaluate_risk(fdr_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Risk evaluation error for {fdr_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Risk calculation failed: {e}")
