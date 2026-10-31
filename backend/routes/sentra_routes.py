"""
PREDICTRA-X SENTRA 4-Layer Verification & Auto-Repair API Routes
"""
import logging
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import FDRRecordModel, VerificationResult, VerificationFinding, AutoRepairProposal
from auth import AuthenticatedUser, get_current_user
from sentra.verification_orchestrator import verification_orchestrator
from guardian.auto_repair import auto_repair_engine

logger = logging.getLogger("predictra.routes.sentra")

router = APIRouter(prefix="/api/sentra", tags=["SENTRA 4-Layer Verification"])


class AutoRepairReviewRequest(BaseModel):
    action: str  # "APPROVE" or "REJECT"
    notes: Optional[str] = None


@router.post("/{fdr_id}/verify", summary="Run full SENTRA 4-Layer Verification on FDR")
def verify_fdr(
    fdr_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        result = verification_orchestrator.run_verification(fdr_id, operator_username=user.username)
        # Also auto-evaluate any repair proposals
        auto_repair_engine.evaluate_proposals(fdr_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Verification error for {fdr_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Verification failed: {e}")


@router.get("/{fdr_id}/results", summary="Get stored 4-layer verification results and findings")
def get_verification_results(
    fdr_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fdr = db.query(FDRRecordModel).filter(FDRRecordModel.id == fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR record {fdr_id} not found.")

    ver = db.query(VerificationResult).filter(VerificationResult.fdr_id == fdr.id).first()
    if not ver:
        # Run verification automatically on-demand if not yet evaluated
        return verification_orchestrator.run_verification(fdr_id, operator_username=user.username)

    findings = db.query(VerificationFinding).filter(VerificationFinding.verification_result_id == ver.id).all()

    findings_by_layer = {1: [], 2: [], 3: [], 4: []}
    for f in findings:
        findings_by_layer[f.layer_number].append({
            "id": f.id,
            "layer_number": f.layer_number,
            "finding_type": f.finding_type,
            "field_key": f.field_key,
            "severity": f.severity,
            "explanation": f.explanation,
            "bounding_box": f.bounding_box,
            "detection_method": f.detection_method,
            "confidence": f.confidence,
            "evidence_data": f.evidence_data,
        })

    return {
        "success": True,
        "fdr_id": fdr.id,
        "receipt_number": fdr.receipt_number,
        "bank_name": fdr.bank_name,
        "principal_amount": fdr.principal_amount,
        "maturity_amount": fdr.maturity_amount,
        "overall_status": ver.overall_status,
        "risk_score": ver.overall_risk_score,
        "risk_severity": ver.risk_severity,
        "bank_confirmation_status": ver.bank_confirmation_status,
        "layer_statuses": {
            "layer1": ver.layer1_status,
            "layer2": ver.layer2_status,
            "layer3": ver.layer3_status,
            "layer4": ver.layer4_status,
        },
        "summary_explanation": ver.summary_explanation,
        "mathematical_details": ver.mathematical_details,
        "bank_verification_details": ver.bank_verification_details,
        "findings_by_layer": findings_by_layer,
        "total_findings": len(findings),
        "verified_at": ver.updated_at.isoformat() if ver.updated_at else None,
    }


@router.get("/{fdr_id}/proposals", summary="List auto-repair proposals for FDR")
def get_repair_proposals(
    fdr_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proposals = db.query(AutoRepairProposal).filter(AutoRepairProposal.fdr_id == fdr_id).all()
    return {
        "fdr_id": fdr_id,
        "count": len(proposals),
        "proposals": [
            {
                "id": p.id,
                "field_key": p.field_key,
                "field_label": p.field_label,
                "original_value": p.original_value,
                "proposed_value": p.proposed_value,
                "final_approved_value": p.final_approved_value,
                "reason": p.reason_for_correction,
                "model_method": p.model_method_used,
                "status": p.status,
                "reviewed_by": p.reviewed_by,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in proposals
        ],
    }


@router.post("/auto-repair/{proposal_id}/review", summary="Approve or Reject an Auto-Repair Proposal")
def review_proposal(
    proposal_id: str,
    req: AutoRepairReviewRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        return auto_repair_engine.review_proposal(
            proposal_id=proposal_id,
            action=req.action,
            reviewer_username=user.username,
            custom_notes=req.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed updating proposal: {e}")
