"""
PREDICTRA-X SENTRA AI Guardian & Anomaly API Routes
"""
import logging
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import FDRRecordModel, AnomalyEvent
from auth import AuthenticatedUser, get_current_user
from guardian.anomaly_detector import ai_guardian

logger = logging.getLogger("predictra.routes.guardian")

router = APIRouter(tags=["SENTRA AI Guardian & Anomalies"])


class AnomalyResolutionRequest(BaseModel):
    status: str  # "RESOLVED" or "FALSE_POSITIVE"
    notes: Optional[str] = None


@router.get("/api/guardian/{fdr_id}/analysis", summary="Run AI Guardian Anomaly Analysis on FDR")
def get_guardian_analysis(
    fdr_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        return ai_guardian.analyze_fdr(fdr_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Guardian analysis failed: {e}")


@router.get("/api/anomalies", summary="List all detected anomalies with filtering")
def list_anomalies(
    status_filter: Optional[str] = Query(None, alias="status"),
    severity: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    limit: int = 50,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(AnomalyEvent)
    if status_filter:
        query = query.filter(AnomalyEvent.status == status_filter)
    if severity:
        query = query.filter(AnomalyEvent.severity == severity)
    if anomaly_type:
        query = query.filter(AnomalyEvent.anomaly_type == anomaly_type)

    total = query.count()
    items = query.order_by(AnomalyEvent.created_at.desc()).limit(limit).all()

    results = []
    for it in items:
        fdr = db.query(FDRRecordModel).filter(FDRRecordModel.id == it.fdr_id).first()
        results.append({
            "id": it.id,
            "fdr_id": it.fdr_id,
            "fdr_ref": fdr.receipt_number if fdr else None,
            "bank_name": fdr.bank_name if fdr else None,
            "anomaly_type": it.anomaly_type,
            "field_name": it.field_name,
            "original_value": it.original_value,
            "detected_value_or_pattern": it.detected_value_or_pattern,
            "evidence_coords": it.evidence_coords,
            "detection_method": it.detection_method,
            "severity": it.severity,
            "reason_for_flagging": it.reason_for_flagging,
            "recommended_action": it.recommended_action,
            "status": it.status,
            "resolved_by": it.resolved_by,
            "created_at": it.created_at.isoformat() if it.created_at else None,
        })

    return {
        "total": total,
        "count": len(results),
        "anomalies": results,
    }


@router.patch("/api/anomalies/{anomaly_id}/resolve", summary="Resolve or mark false positive on an anomaly")
def resolve_anomaly(
    anomaly_id: str,
    req: AnomalyResolutionRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    anom = db.query(AnomalyEvent).filter(AnomalyEvent.id == anomaly_id).first()
    if not anom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Anomaly {anomaly_id} not found.")

    anom.status = req.status.upper()
    anom.resolved_by = user.username
    anom.resolution_notes = req.notes
    db.commit()

    return {
        "success": True,
        "anomaly_id": anom.id,
        "status": anom.status,
        "resolved_by": anom.resolved_by,
    }
