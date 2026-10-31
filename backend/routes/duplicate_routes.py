"""
PREDICTRA-X Duplicate Intelligence API Routes
"""
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import FDRRecordModel, Document, DuplicateMatch
from auth import AuthenticatedUser, get_current_user
from duplicates.duplicate_engine import duplicate_engine
from audit import audit_log

logger = logging.getLogger("predictra.routes.duplicates")

router = APIRouter(prefix="/api/duplicates", tags=["Duplicate Intelligence"])


class DuplicateReviewRequest(BaseModel):
    action: str  # "CONFIRM_DUPLICATE" or "FALSE_POSITIVE" or "MERGE"
    notes: Optional[str] = None


@router.get("", summary="List all detected duplicate matches across 3 levels")
def list_duplicates(
    match_level: Optional[str] = None,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Ensure fresh scan across active records
    fdrs = db.query(FDRRecordModel).all()
    for f in fdrs:
        duplicate_engine.scan_for_duplicates(f.id)

    query = db.query(DuplicateMatch)
    if match_level:
        query = query.filter(DuplicateMatch.match_level == match_level)

    items = query.order_by(DuplicateMatch.created_at.desc()).all()

    results = []
    for it in items:
        p_fdr = db.query(FDRRecordModel).filter(FDRRecordModel.id == it.primary_fdr_id).first()
        d_fdr = db.query(FDRRecordModel).filter(FDRRecordModel.id == it.duplicate_fdr_id).first()

        results.append({
            "id": it.id,
            "match_level": it.match_level,
            "similarity_score": it.similarity_score,
            "primary_fdr_id": it.primary_fdr_id,
            "primary_ref": p_fdr.receipt_number if p_fdr else "N/A",
            "primary_bank": p_fdr.bank_name if p_fdr else "N/A",
            "primary_principal": p_fdr.principal_amount if p_fdr else 0,
            "duplicate_fdr_id": it.duplicate_fdr_id,
            "duplicate_ref": d_fdr.receipt_number if d_fdr else "N/A",
            "duplicate_bank": d_fdr.bank_name if d_fdr else "N/A",
            "duplicate_principal": d_fdr.principal_amount if d_fdr else 0,
            "matched_fields": it.matched_fields_json or [],
            "conflicting_fields": it.conflicting_fields_json or [],
            "recommended_action": it.recommended_action,
            "status": it.status,
            "reviewed_by": it.reviewed_by,
            "created_at": it.created_at.isoformat() if it.created_at else None,
        })

    return {
        "count": len(results),
        "duplicates": results,
    }


@router.get("/{duplicate_id}", summary="Get detailed side-by-side comparison for duplicate match")
def get_duplicate_detail(
    duplicate_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dm = db.query(DuplicateMatch).filter(DuplicateMatch.id == duplicate_id).first()
    if not dm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Duplicate match {duplicate_id} not found.")

    p_fdr = db.query(FDRRecordModel).filter(FDRRecordModel.id == dm.primary_fdr_id).first()
    d_fdr = db.query(FDRRecordModel).filter(FDRRecordModel.id == dm.duplicate_fdr_id).first()

    return {
        "id": dm.id,
        "match_level": dm.match_level,
        "similarity_score": dm.similarity_score,
        "status": dm.status,
        "recommended_action": dm.recommended_action,
        "matched_fields": dm.matched_fields_json or [],
        "conflicting_fields": dm.conflicting_fields_json or [],
        "primary_fdr": {
            "id": p_fdr.id if p_fdr else None,
            "receipt_number": p_fdr.receipt_number if p_fdr else "N/A",
            "bank_name": p_fdr.bank_name if p_fdr else "N/A",
            "branch_name": p_fdr.branch_name if p_fdr else "N/A",
            "principal_amount": p_fdr.principal_amount if p_fdr else 0,
            "interest_rate": p_fdr.interest_rate if p_fdr else 0,
            "issue_date": p_fdr.issue_date if p_fdr else "N/A",
            "maturity_date": p_fdr.maturity_date if p_fdr else "N/A",
            "maturity_amount": p_fdr.maturity_amount if p_fdr else 0,
        },
        "duplicate_fdr": {
            "id": d_fdr.id if d_fdr else None,
            "receipt_number": d_fdr.receipt_number if d_fdr else "N/A",
            "bank_name": d_fdr.bank_name if d_fdr else "N/A",
            "branch_name": d_fdr.branch_name if d_fdr else "N/A",
            "principal_amount": d_fdr.principal_amount if d_fdr else 0,
            "interest_rate": d_fdr.interest_rate if d_fdr else 0,
            "issue_date": d_fdr.issue_date if d_fdr else "N/A",
            "maturity_date": d_fdr.maturity_date if d_fdr else "N/A",
            "maturity_amount": d_fdr.maturity_amount if d_fdr else 0,
        },
    }


@router.post("/{duplicate_id}/review", summary="Review and apply decision on duplicate match")
def review_duplicate(
    duplicate_id: str,
    req: DuplicateReviewRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dm = db.query(DuplicateMatch).filter(DuplicateMatch.id == duplicate_id).first()
    if not dm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Duplicate match {duplicate_id} not found.")

    dm.status = req.action.upper()
    dm.reviewed_by = user.username
    dm.reviewed_at = datetime.now(timezone.utc)

    audit_log.record(
        action="DUPLICATE_REVIEWED",
        actor_id=user.username,
        actor_username=user.username,
        resource_id=f"dup_{dm.id}",
        details={
            "duplicate_id": dm.id,
            "action": req.action,
            "notes": req.notes,
        },
    )

    db.commit()

    return {
        "success": True,
        "duplicate_id": dm.id,
        "status": dm.status,
        "reviewed_by": dm.reviewed_by,
    }
