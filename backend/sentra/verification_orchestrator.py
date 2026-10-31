"""
PREDICTRA-X SENTRA 4-Layer Verification Orchestrator
Coordinates independent execution of:
- Layer 1: Page Evidence Verification (OpenCV / Image Quality / Tamper Heuristics)
- Layer 2: Financial Math Verification (NumPy / Compound Interest / Dates)
- Layer 3: Bank Details & QR Verification (IFSC / National Registry / QR Code)
- Layer 4: Doubtful Digit Verification (Multi-Model Candidates / Morphological Check)
Persists findings into PostgreSQL and updates FDR verification lifecycle status.
"""
import logging
from typing import Dict, Any, Optional

from database import get_db_context
from models import (
    FDRRecordModel,
    Document,
    ExtractionResult,
    ExtractionField,
    VerificationResult,
    VerificationFinding,
    NotificationEvent,
)
from storage import storage_service
from audit import audit_log
from sentra.layer1_evidence import layer1_verifier
from sentra.layer2_financial import layer2_verifier
from sentra.layer3_bank import layer3_verifier
from sentra.layer4_doubtful_digit import layer4_verifier

logger = logging.getLogger("predictra.sentra.orchestrator")


class VerificationOrchestrator:
    def run_verification(self, fdr_id: str, operator_username: str = "sentra-admin") -> Dict[str, Any]:
        """
        Executes complete 4-layer verification for an FDR record.
        Persists results transactionally and returns comprehensive verification payload.
        """
        with get_db_context() as db:
            fdr = db.query(FDRRecordModel).filter(FDRRecordModel.id == fdr_id).first()
            if not fdr:
                raise ValueError(f"FDR record with ID {fdr_id} not found.")

            document_id = fdr.document_id
            doc_record = db.query(Document).filter(Document.document_id == document_id).first() if document_id else None

            # Gather extracted fields and words
            fields_data = []
            words_with_boxes = []
            raw_text = ""
            doc_bytes = None

            if document_id:
                ext_res = db.query(ExtractionResult).filter(ExtractionResult.document_id == document_id).first()
                if ext_res:
                    ext_fields = db.query(ExtractionField).filter(ExtractionField.extraction_result_id == ext_res.id).all()
                    fields_data = [
                        {
                            "field_key": f.field_key,
                            "field_label": f.field_label,
                            "original_value": f.original_value,
                            "current_value": f.current_value,
                            "bounding_box": f.bounding_box,
                            "ocr_confidence": f.ocr_confidence,
                        }
                        for f in ext_fields
                    ]
                    if ext_res.raw_extracted_json:
                        raw_text = str(ext_res.raw_extracted_json)

                if doc_record and doc_record.stored_object_key:
                    try:
                        doc_bytes = storage_service.get_document_bytes(doc_record.stored_object_key)
                    except Exception as e:
                        logger.warning(f"Could not load doc bytes: {e}")

            # ------------------------------------------------------------------
            # Execute Layer 1: Page Evidence
            # ------------------------------------------------------------------
            l1_result = layer1_verifier.verify(doc_bytes, words_with_boxes, raw_text)

            # ------------------------------------------------------------------
            # Execute Layer 2: Financial Math
            # ------------------------------------------------------------------
            l2_result = layer2_verifier.verify(
                principal=fdr.principal_amount,
                interest_rate=fdr.interest_rate,
                maturity_amount=fdr.maturity_amount,
                issue_date_str=fdr.issue_date,
                maturity_date_str=fdr.maturity_date,
                compounding_frequency=fdr.compounding_frequency or "Quarterly",
                tenure_months=fdr.tenure_months or 12,
            )

            # ------------------------------------------------------------------
            # Execute Layer 3: Bank Details & QR
            # ------------------------------------------------------------------
            l3_result = layer3_verifier.verify(
                bank_name=fdr.bank_name,
                ifsc_code=fdr.ifsc_code,
                branch_name=fdr.branch_name,
                fdr_number=fdr.receipt_number,
                image_bytes=doc_bytes,
            )

            # ------------------------------------------------------------------
            # Execute Layer 4: Doubtful Digits
            # ------------------------------------------------------------------
            tenure_years = l2_result.get("calculation_details", {}).get("stated_tenure_years", 1.0)
            l4_result = layer4_verifier.verify(
                fields=fields_data,
                principal_amount=fdr.principal_amount,
                maturity_amount=fdr.maturity_amount,
                interest_rate=fdr.interest_rate,
                tenure_years=tenure_years,
            )

            # ------------------------------------------------------------------
            # Compute Transparent Composite Risk Score (0 - 100)
            # ------------------------------------------------------------------
            all_findings = (
                l1_result.get("findings", [])
                + l2_result.get("findings", [])
                + l3_result.get("findings", [])
                + l4_result.get("findings", [])
            )

            # Base score: start with clean baseline 5.0 (system operating margin)
            risk_score = 5.0

            for f in all_findings:
                sev = f.get("severity", "LOW")
                if sev == "CRITICAL":
                    risk_score += 35.0
                elif sev == "HIGH":
                    risk_score += 18.0
                elif sev == "MEDIUM":
                    risk_score += 8.0
                elif sev == "LOW":
                    risk_score += 1.0

            # Penalize unconfirmed bank status
            bank_status = l3_result.get("bank_confirmation_status", "PENDING")
            if bank_status == "MISMATCH":
                risk_score += 30.0
            elif bank_status == "NOT_CONFIRMED":
                risk_score += 15.0

            risk_score = min(100.0, max(0.0, risk_score))

            if risk_score >= 60.0 or any(f.get("severity") == "CRITICAL" for f in all_findings):
                risk_severity = "CRITICAL"
                overall_status = "SUSPICIOUS"
            elif risk_score >= 35.0 or any(f.get("severity") == "HIGH" for f in all_findings):
                risk_severity = "HIGH"
                overall_status = "REVIEW_REQUIRED"
            elif risk_score >= 20.0 or any(f.get("severity") == "MEDIUM" for f in all_findings):
                risk_severity = "MEDIUM"
                overall_status = "VERIFIED_WITH_WARNINGS"
            else:
                risk_severity = "LOW"
                overall_status = "VERIFIED"

            # ------------------------------------------------------------------
            # Persist VerificationResult & Findings in PostgreSQL
            # ------------------------------------------------------------------
            existing_ver = db.query(VerificationResult).filter(VerificationResult.fdr_id == fdr.id).first()
            if existing_ver:
                db.delete(existing_ver)
                db.flush()

            ver_result = VerificationResult(
                fdr_id=fdr.id,
                document_id=document_id,
                overall_status=overall_status,
                overall_risk_score=round(risk_score, 1),
                risk_severity=risk_severity,
                layer1_status=l1_result["status"],
                layer2_status=l2_result["status"],
                layer3_status=l3_result["status"],
                layer4_status=l4_result["status"],
                bank_confirmation_status=bank_status,
                summary_explanation=(
                    f"Overall decision: {overall_status} (Risk Score: {risk_score:.1f}/100, Severity: {risk_severity}). "
                    f"Layer 1: {l1_result['status']}, Layer 2: {l2_result['status']}, "
                    f"Layer 3: {l3_result['status']} ({bank_status}), Layer 4: {l4_result['status']}."
                ),
                mathematical_details=l2_result.get("calculation_details"),
                bank_verification_details=l3_result.get("qr_details"),
                visual_evidence_summary={"quality_score": l1_result.get("quality_score")},
                doubtful_digits_summary={"tokens_checked": len(l4_result.get("doubtful_fields", []))},
                verified_by=operator_username,
            )
            db.add(ver_result)
            db.flush()

            for f in all_findings:
                vf = VerificationFinding(
                    verification_result_id=ver_result.id,
                    layer_number=f["layer_number"],
                    finding_type=f["finding_type"],
                    field_key=f.get("field_key"),
                    severity=f.get("severity", "LOW"),
                    explanation=f["explanation"],
                    bounding_box=f.get("bounding_box"),
                    detection_method=f["detection_method"],
                    confidence=f.get("confidence", 0.95),
                    evidence_data=f.get("evidence_data"),
                )
                db.add(vf)

            # Update FDR record summary
            fdr.verification_status = overall_status
            fdr.layer1_evidence = f"L1: {l1_result['status']} (Score {l1_result.get('quality_score')}%)"
            fdr.layer2_calculations = f"L2: {l2_result['status']} (Variance {l2_result.get('calculation_details', {}).get('percentage_difference', 0.0)}%)"
            fdr.layer3_bank_validation = f"L3: {l3_result['status']} ({bank_status})"
            fdr.layer4_doubtful_digits = f"L4: {l4_result['status']} ({len(l4_result.get('doubtful_fields', []))} digits validated)"

            # Record in Hash-Chained Audit Log
            audit_log.record(
                action="FDR_VERIFIED_SENTRA",
                actor_id=operator_username,
                actor_username=operator_username,
                resource_id=fdr.receipt_number,
                details={
                    "fdr_id": fdr.id,
                    "overall_status": overall_status,
                    "risk_score": risk_score,
                    "risk_severity": risk_severity,
                    "total_findings": len(all_findings),
                    "bank_confirmation": bank_status,
                },
            )

            # Generate in-app alert if high/critical
            if risk_severity in ["HIGH", "CRITICAL"]:
                notif = NotificationEvent(
                    fdr_id=fdr.id,
                    title=f"Security Alert: Suspicious Findings on {fdr.receipt_number}",
                    message=f"SENTRA flagged FDR {fdr.receipt_number} ({fdr.bank_name}) with {risk_severity} risk severity (Score: {risk_score:.1f}/100).",
                    severity=risk_severity,
                    category="VERIFICATION",
                    event_id=f"ver_{fdr.id}_{int(risk_score)}",
                    action_link=f"/verification/{fdr.id}",
                )
                db.add(notif)

            db.commit()

            return {
                "success": True,
                "fdr_id": fdr.id,
                "receipt_number": fdr.receipt_number,
                "bank_name": fdr.bank_name,
                "principal_amount": fdr.principal_amount,
                "maturity_date": fdr.maturity_date,
                "overall_status": overall_status,
                "risk_score": round(risk_score, 1),
                "risk_severity": risk_severity,
                "bank_confirmation_status": bank_status,
                "layer_results": {
                    "layer1": l1_result,
                    "layer2": l2_result,
                    "layer3": l3_result,
                    "layer4": l4_result,
                },
                "total_findings": len(all_findings),
                "findings": all_findings,
            }


verification_orchestrator = VerificationOrchestrator()
