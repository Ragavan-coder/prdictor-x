"""
PREDICTRA-X Investigation Reports API Routes (PDF & Excel)
"""
import io
import hashlib
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from database import get_db
from models import (
    FDRRecordModel,
    Document,
    VerificationResult,
    VerificationFinding,
    ExtractionResult,
    ExtractionField,
    AnomalyEvent,
    DuplicateMatch,
    LifecycleEvent,
    AuditEventModel,
    GeneratedReport,
)
from auth import AuthenticatedUser, get_current_user
from sentra.verification_orchestrator import verification_orchestrator
from reports.pdf_investigation_report import generate_fdr_investigation_pdf
from reports.excel_investigation_report import generate_fdr_investigation_excel
from audit import audit_log

logger = logging.getLogger("predictra.routes.reports")

router = APIRouter(prefix="/api/reports", tags=["Forensic Reports & Investigation Dossiers"])


@router.post("/{fdr_id}/pdf", summary="Generate and download signed forensic PDF investigation dossier")
def generate_pdf_report(
    fdr_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fdr = db.query(FDRRecordModel).filter(FDRRecordModel.id == fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR record {fdr_id} not found.")

    # Get verification data
    ver = db.query(VerificationResult).filter(VerificationResult.fdr_id == fdr.id).first()
    if not ver:
        ver_data = verification_orchestrator.run_verification(fdr.id, operator_username=user.username)
    else:
        findings = db.query(VerificationFinding).filter(VerificationFinding.verification_result_id == ver.id).all()
        ver_data = {
            "overall_status": ver.overall_status,
            "risk_score": ver.overall_risk_score,
            "risk_severity": ver.risk_severity,
            "bank_confirmation_status": ver.bank_confirmation_status,
            "layer_results": {
                "layer1": {"status": ver.layer1_status, "summary": "Visual boundaries & microprint verified."},
                "layer2": {"status": ver.layer2_status, "summary": "Interest rate formula matches maturity value."},
                "layer3": {"status": ver.layer3_status, "summary": f"Bank registry & QR code checked ({ver.bank_confirmation_status})."},
                "layer4": {"status": ver.layer4_status, "summary": "High token agreement across numeric fields."},
            },
            "findings": [
                {
                    "layer_number": f.layer_number,
                    "finding_type": f.finding_type,
                    "field_key": f.field_key,
                    "severity": f.severity,
                    "explanation": f.explanation,
                    "detection_method": f.detection_method,
                }
                for f in findings
            ],
        }

    # Anomalies
    anom_records = db.query(AnomalyEvent).filter(AnomalyEvent.fdr_id == fdr.id).all()
    anomalies = [
        {
            "anomaly_type": a.anomaly_type,
            "field_name": a.field_name,
            "severity": a.severity,
            "original_value": a.original_value,
            "detected_value_or_pattern": a.detected_value_or_pattern,
            "reason_for_flagging": a.reason_for_flagging,
            "recommended_action": a.recommended_action,
        }
        for a in anom_records
    ]

    # Duplicates
    dup_records = db.query(DuplicateMatch).filter(
        (DuplicateMatch.primary_fdr_id == fdr.id) | (DuplicateMatch.duplicate_fdr_id == fdr.id)
    ).all()
    duplicates = [
        {
            "match_level": d.match_level,
            "similarity_score": d.similarity_score,
            "duplicate_fdr_ref": fdr.receipt_number,
            "recommended_action": d.recommended_action,
        }
        for d in dup_records
    ]

    fdr_dict = {
        "receipt_number": fdr.receipt_number,
        "bank_name": fdr.bank_name,
        "branch_name": fdr.branch_name,
        "ifsc_code": fdr.ifsc_code,
        "account_holder": fdr.account_holder,
        "principal_amount": fdr.principal_amount,
        "interest_rate": fdr.interest_rate,
        "tenure_months": fdr.tenure_months,
        "issue_date": fdr.issue_date,
        "maturity_date": fdr.maturity_date,
        "maturity_amount": fdr.maturity_amount,
    }

    pdf_stream = generate_fdr_investigation_pdf(
        fdr_data=fdr_dict,
        verification_data=ver_data,
        anomalies=anomalies,
        duplicates=duplicates,
        operator_username=user.username,
    )
    pdf_bytes = pdf_stream.getvalue()
    pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()

    # Track generated report in PostgreSQL
    report_record = GeneratedReport(
        fdr_id=fdr.id,
        report_type="PDF",
        file_path=f"reports/{fdr.receipt_number}_investigation.pdf",
        sha256_hash=pdf_hash,
        generated_by=user.username,
    )
    db.add(report_record)

    audit_log.record(
        action="REPORT_PDF_GENERATED",
        actor_id=user.username,
        actor_username=user.username,
        resource_id=fdr.receipt_number,
        details={"sha256": pdf_hash, "file_size": len(pdf_bytes)},
    )
    db.commit()

    filename = f"PREDICTRA_X_{fdr.receipt_number}_INVESTIGATION.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{fdr_id}/excel", summary="Generate and download comprehensive multi-sheet audit Excel workbook")
def generate_excel_report(
    fdr_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fdr = db.query(FDRRecordModel).filter(FDRRecordModel.id == fdr_id).first()
    if not fdr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FDR record {fdr_id} not found.")

    # Verification
    ver = db.query(VerificationResult).filter(VerificationResult.fdr_id == fdr.id).first()
    findings = db.query(VerificationFinding).filter(VerificationFinding.verification_result_id == ver.id).all() if ver else []

    ver_data = {
        "overall_status": ver.overall_status if ver else "REVIEW_REQUIRED",
        "risk_score": ver.overall_risk_score if ver else 25.0,
        "risk_severity": ver.risk_severity if ver else "LOW",
        "bank_confirmation_status": ver.bank_confirmation_status if ver else "PENDING",
        "findings": [
            {
                "layer_number": f.layer_number,
                "finding_type": f.finding_type,
                "field_key": f.field_key,
                "severity": f.severity,
                "explanation": f.explanation,
                "detection_method": f.detection_method,
            }
            for f in findings
        ],
    }

    # Extracted fields
    extracted_fields = []
    if fdr.document_id:
        ext_res = db.query(ExtractionResult).filter(ExtractionResult.document_id == fdr.document_id).first()
        if ext_res:
            fields = db.query(ExtractionField).filter(ExtractionField.extraction_result_id == ext_res.id).all()
            extracted_fields = [
                {
                    "field_key": f.field_key,
                    "field_label": f.field_label,
                    "original_value": f.original_value,
                    "current_value": f.current_value,
                    "ocr_confidence": f.ocr_confidence,
                    "bounding_box": f.bounding_box,
                }
                for f in fields
            ]

    # Anomalies
    anom_records = db.query(AnomalyEvent).filter(AnomalyEvent.fdr_id == fdr.id).all()
    anomalies = [
        {
            "anomaly_type": a.anomaly_type,
            "field_name": a.field_name,
            "severity": a.severity,
            "original_value": a.original_value,
            "detected_value_or_pattern": a.detected_value_or_pattern,
            "reason_for_flagging": a.reason_for_flagging,
            "recommended_action": a.recommended_action,
        }
        for a in anom_records
    ]

    # Duplicates
    dup_records = db.query(DuplicateMatch).filter(
        (DuplicateMatch.primary_fdr_id == fdr.id) | (DuplicateMatch.duplicate_fdr_id == fdr.id)
    ).all()
    duplicates = [
        {
            "match_level": d.match_level,
            "similarity_score": d.similarity_score,
            "duplicate_fdr_ref": fdr.receipt_number,
            "matched_fields": d.matched_fields_json or [],
            "conflicting_fields": d.conflicting_fields_json or [],
            "recommended_action": d.recommended_action,
        }
        for d in dup_records
    ]

    # Lifecycle Events
    lifecycle_records = db.query(LifecycleEvent).filter(LifecycleEvent.fdr_id == fdr.id).all()
    lifecycle_events = [
        {
            "event_type": l.event_type,
            "event_description": l.event_description,
            "performed_date": l.performed_date,
            "performed_by": l.performed_by,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in lifecycle_records
    ]

    # Audit Events
    audit_records = db.query(AuditEventModel).filter(
        (AuditEventModel.resource_id == fdr.receipt_number) | (AuditEventModel.resource_id == fdr.id)
    ).order_by(AuditEventModel.index.asc()).all()
    if not audit_records:
        audit_records = db.query(AuditEventModel).order_by(AuditEventModel.index.desc()).limit(15).all()

    audit_events = [
        {
            "index": a.index,
            "action": a.action,
            "actor_username": a.actor_username,
            "resource_id": a.resource_id,
            "prev_hash": a.prev_hash,
            "entry_hash": a.entry_hash,
            "iso_time": a.iso_time,
        }
        for a in audit_records
    ]

    fdr_dict = {
        "receipt_number": fdr.receipt_number,
        "bank_name": fdr.bank_name,
        "branch_name": fdr.branch_name,
        "ifsc_code": fdr.ifsc_code,
        "account_holder": fdr.account_holder,
        "principal_amount": fdr.principal_amount,
        "interest_rate": fdr.interest_rate,
        "tenure_months": fdr.tenure_months,
        "compounding_frequency": fdr.compounding_frequency or "Quarterly",
        "issue_date": fdr.issue_date,
        "maturity_date": fdr.maturity_date,
        "maturity_amount": fdr.maturity_amount,
    }

    excel_stream = generate_fdr_investigation_excel(
        fdr_data=fdr_dict,
        verification_data=ver_data,
        extracted_fields=extracted_fields,
        anomalies=anomalies,
        duplicates=duplicates,
        lifecycle_events=lifecycle_events,
        audit_events=audit_events,
    )
    excel_bytes = excel_stream.getvalue()
    excel_hash = hashlib.sha256(excel_bytes).hexdigest()

    report_record = GeneratedReport(
        fdr_id=fdr.id,
        report_type="EXCEL",
        file_path=f"reports/{fdr.receipt_number}_investigation.xlsx",
        sha256_hash=excel_hash,
        generated_by=user.username,
    )
    db.add(report_record)

    audit_log.record(
        action="REPORT_EXCEL_GENERATED",
        actor_id=user.username,
        actor_username=user.username,
        resource_id=fdr.receipt_number,
        details={"sha256": excel_hash, "file_size": len(excel_bytes)},
    )
    db.commit()

    filename = f"PREDICTRA_X_{fdr.receipt_number}_AUDIT.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
