"""
PREDICTRA-X Phase 4: Risk Intelligence & Decision Engine
Evaluates multi-dimensional risk signals to produce an explainable composite risk decision:
- Visual integrity score from Layer 1
- Compound interest divergence from Layer 2
- Institutional confirmation state from Layer 3
- Token uncertainty from Layer 4
- Duplicate / near-duplicate alerts from Phase 5
Classifies each FDR into:
VERIFIED, VERIFIED_WITH_WARNINGS, REVIEW_REQUIRED, SUSPICIOUS, BANK_CONFIRMATION_PENDING, PROCESSING_FAILED
"""
import logging
from typing import Dict, List, Any, Optional

from database import get_db_context
from models import (
    FDRRecordModel,
    VerificationResult,
    VerificationFinding,
    AnomalyEvent,
    DuplicateMatch,
)

logger = logging.getLogger("predictra.risk.engine")


class RiskDecisionEngine:
    def evaluate_risk(self, fdr_id: str) -> Dict[str, Any]:
        """
        Calculates granular, transparent risk breakdown and final decision matrix.
        Returns explainable factor weights without arbitrary black-box scores.
        """
        with get_db_context() as db:
            fdr = db.query(FDRRecordModel).filter(FDRRecordModel.id == fdr_id).first()
            if not fdr:
                raise ValueError(f"FDR record {fdr_id} not found.")

            ver_result = db.query(VerificationResult).filter(VerificationResult.fdr_id == fdr.id).first()
            findings = db.query(VerificationFinding).filter(VerificationFinding.verification_result_id == ver_result.id).all() if ver_result else []
            anomalies = db.query(AnomalyEvent).filter(AnomalyEvent.fdr_id == fdr.id).all()
            duplicates = db.query(DuplicateMatch).filter(
                (DuplicateMatch.primary_fdr_id == fdr.id) | (DuplicateMatch.duplicate_fdr_id == fdr.id)
            ).all()

            # Detailed Factor Weights
            factor_scores = {
                "visual_evidence_risk": 0.0,
                "financial_math_risk": 0.0,
                "bank_confirmation_risk": 0.0,
                "token_confidence_risk": 0.0,
                "duplicate_similarity_risk": 0.0,
            }

            risk_indicators = []

            # 1. Visual Findings
            l1_findings = [f for f in findings if f.layer_number == 1]
            for f in l1_findings:
                if f.severity == "CRITICAL":
                    factor_scores["visual_evidence_risk"] += 35.0
                    risk_indicators.append(f"Critical Visual Defect: {f.finding_type}")
                elif f.severity == "HIGH":
                    factor_scores["visual_evidence_risk"] += 20.0
                    risk_indicators.append(f"High Visual Warning: {f.finding_type}")
                elif f.severity == "MEDIUM":
                    factor_scores["visual_evidence_risk"] += 8.0

            # 2. Financial Math Findings
            l2_findings = [f for f in findings if f.layer_number == 2]
            for f in l2_findings:
                if f.severity == "CRITICAL":
                    factor_scores["financial_math_risk"] += 40.0
                    risk_indicators.append(f"Financial Math Violation: {f.finding_type}")
                elif f.severity == "HIGH":
                    factor_scores["financial_math_risk"] += 22.0
                    risk_indicators.append(f"Interest Math Divergence: {f.finding_type}")
                elif f.severity == "MEDIUM":
                    factor_scores["financial_math_risk"] += 10.0

            # 3. Bank Confirmation
            bank_status = ver_result.bank_confirmation_status if ver_result else "PENDING"
            if bank_status == "MISMATCH":
                factor_scores["bank_confirmation_risk"] += 35.0
                risk_indicators.append("Institutional Mismatch: Bank registry conflict")
            elif bank_status == "NOT_CONFIRMED":
                factor_scores["bank_confirmation_risk"] += 15.0
                risk_indicators.append("Bank Details Incomplete: No IFSC code")
            elif bank_status == "PENDING":
                factor_scores["bank_confirmation_risk"] += 5.0

            # 4. Token Uncertainty
            l4_findings = [f for f in findings if f.layer_number == 4 and f.severity in ["MEDIUM", "HIGH", "CRITICAL"]]
            if l4_findings:
                factor_scores["token_confidence_risk"] += len(l4_findings) * 8.0
                risk_indicators.append(f"Uncertain Numeric Tokens: {len(l4_findings)} fields flagged")

            # 5. Duplicate Matches
            if duplicates:
                for d in duplicates:
                    if d.match_level == "LEVEL_1_EXACT_FILE":
                        factor_scores["duplicate_similarity_risk"] += 15.0
                        risk_indicators.append("Identical SHA-256 File Re-uploaded")
                    elif d.match_level == "LEVEL_3_FINANCIAL_RECORD":
                        factor_scores["duplicate_similarity_risk"] += 30.0
                        risk_indicators.append("Conflicting Financial Record with Same FDR #")

            # Clamp individual factors to max 40 each
            for k in factor_scores:
                factor_scores[k] = min(40.0, factor_scores[k])

            total_risk = sum(factor_scores.values()) + 5.0  # +5 base operating baseline
            total_risk = min(100.0, max(0.0, round(total_risk, 1)))

            if total_risk >= 65.0 or any("Critical" in ind or "Violation" in ind for ind in risk_indicators):
                severity = "CRITICAL"
                classification = "SUSPICIOUS"
            elif total_risk >= 40.0 or any("High" in ind for ind in risk_indicators):
                severity = "HIGH"
                classification = "REVIEW_REQUIRED"
            elif total_risk >= 20.0 or bank_status == "PENDING":
                severity = "MEDIUM"
                classification = "BANK_CONFIRMATION_PENDING" if bank_status == "PENDING" and total_risk < 30.0 else "VERIFIED_WITH_WARNINGS"
            else:
                severity = "LOW"
                classification = "VERIFIED"

            decision_explanation = (
                f"FDR {fdr.receipt_number} classified as {classification} with composite risk score of {total_risk}/100 "
                f"(Severity: {severity}). "
                f"{len(risk_indicators)} active risk indicators evaluated."
            )

            return {
                "fdr_id": fdr.id,
                "receipt_number": fdr.receipt_number,
                "bank_name": fdr.bank_name,
                "classification": classification,
                "severity": severity,
                "composite_risk_score": total_risk,
                "decision_explanation": decision_explanation,
                "factor_scores": factor_scores,
                "risk_indicators": risk_indicators,
                "total_findings_count": len(findings),
                "total_anomalies_count": len(anomalies),
                "total_duplicates_count": len(duplicates),
                "bank_confirmation_status": bank_status,
            }


risk_engine = RiskDecisionEngine()
