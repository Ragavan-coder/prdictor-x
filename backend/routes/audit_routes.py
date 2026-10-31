"""
PREDICTRA-X Cryptographic Audit Trail API Routes
"""
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import AuditEventModel, FDRRecordModel
from auth import AuthenticatedUser, get_current_user
from audit import audit_verifier

logger = logging.getLogger("predictra.routes.audit")

router = APIRouter(prefix="/api/audit", tags=["Audit Trail & Evidence Integrity"])


@router.get("/{fdr_id}", summary="Get audit events for specific FDR record")
def get_fdr_audit_trail(
    fdr_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fdr = db.query(FDRRecordModel).filter(FDRRecordModel.id == fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR record {fdr_id} not found.")

    events = db.query(AuditEventModel).filter(
        (AuditEventModel.resource_id == fdr.receipt_number) |
        (AuditEventModel.resource_id == fdr.document_id) |
        (AuditEventModel.resource_id == fdr.id)
    ).order_by(AuditEventModel.index.asc()).all()

    # If no specific events matched by resource_id, return the last 15 system audit events
    if not events:
        events = db.query(AuditEventModel).order_by(AuditEventModel.index.desc()).limit(15).all()
        events = list(reversed(events))

    results = [
        {
            "id": e.id,
            "index": e.index,
            "action": e.action,
            "actor_id": e.actor_id,
            "actor_username": e.actor_username,
            "resource_id": e.resource_id,
            "details": e.details_json,
            "prev_hash": e.prev_hash,
            "entry_hash": e.entry_hash,
            "timestamp": e.timestamp,
            "iso_time": e.iso_time,
        }
        for e in events
    ]

    return {
        "fdr_id": fdr.id,
        "receipt_number": fdr.receipt_number,
        "count": len(results),
        "events": results,
    }


@router.post("/verify-integrity", summary="Cryptographically verify unbroken SHA-256 Merkle chain integrity")
def verify_audit_integrity(
    user: AuthenticatedUser = Depends(get_current_user),
):
    return audit_verifier.verify_integrity()
