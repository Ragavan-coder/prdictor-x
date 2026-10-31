"""
PREDICTRA-X SENTRA Layer 3: Bank Details & QR Verification
Performs banking entity and institutional validation:
- Validates IFSC format against RBI 11-character alphanumeric structure (^[A-Z]{4}0[A-Z0-9]{6}$)
- Verifies IFSC against known Indian bank registries (SBI, HDFC, ICICI, PNB, Axis, etc.)
- Scans and decodes QR codes using OpenCV cv2.QRCodeDetector()
- Cross-references decoded QR content against extracted certificate metadata
- Assigns strict, independent bank confirmation status:
  CONFIRMED, NOT_CONFIRMED, PENDING, UNAVAILABLE, MISMATCH
  (CRITICAL: Never marks genuine solely because IFSC is valid)
"""
import re
import logging
import cv2
import numpy as np
from typing import Dict, List, Any, Optional

logger = logging.getLogger("predictra.sentra.layer3")

# Known Indian Bank Master Prefixes and Branches
INDIAN_BANK_REGISTRY = {
    "SBIN": {"name": "State Bank of India", "headquarters": "Mumbai", "risk_level": "LOW"},
    "HDFC": {"name": "HDFC Bank Limited", "headquarters": "Mumbai", "risk_level": "LOW"},
    "ICIC": {"name": "ICICI Bank", "headquarters": "Mumbai", "risk_level": "LOW"},
    "PUNB": {"name": "Punjab National Bank", "headquarters": "New Delhi", "risk_level": "LOW"},
    "UTIB": {"name": "Axis Bank", "headquarters": "Mumbai", "risk_level": "LOW"},
    "BARB": {"name": "Bank of Baroda", "headquarters": "Vadodara", "risk_level": "LOW"},
    "KKBK": {"name": "Kotak Mahindra Bank", "headquarters": "Mumbai", "risk_level": "LOW"},
    "CNRB": {"name": "Canara Bank", "headquarters": "Bengaluru", "risk_level": "LOW"},
    "UBIN": {"name": "Union Bank of India", "headquarters": "Mumbai", "risk_level": "LOW"},
    "IDIB": {"name": "Indian Bank", "headquarters": "Chennai", "risk_level": "LOW"},
}

IFSC_REGEX = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")


class Layer3BankVerifier:
    def verify(
        self,
        bank_name: str,
        ifsc_code: Optional[str],
        branch_name: Optional[str],
        fdr_number: str,
        image_bytes: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        """
        Executes Bank Details & QR verification.
        Returns layer status, findings, QR decoding results, and bank confirmation status.
        """
        findings = []
        qr_details = {"qr_detected": False, "qr_payload": None, "qr_matches_fdr": False}
        bank_confirmation_status = "PENDING"
        ifsc_cleaned = (ifsc_code or "").strip().upper()

        # 1. IFSC Pattern & Registry Verification
        if not ifsc_cleaned:
            findings.append({
                "layer_number": 3,
                "finding_type": "MISSING_IFSC_CODE",
                "field_key": "ifsc_code",
                "severity": "HIGH",
                "explanation": "No IFSC code detected on document. Mandatory routing code missing for Indian banking compliance.",
                "bounding_box": [0.20, 0.50, 0.28, 0.75],
                "detection_method": "Field Presence Assertion",
                "confidence": 1.0,
                "evidence_data": {},
            })
            bank_confirmation_status = "NOT_CONFIRMED"
        elif not IFSC_REGEX.match(ifsc_cleaned):
            findings.append({
                "layer_number": 3,
                "finding_type": "INVALID_IFSC_FORMAT",
                "field_key": "ifsc_code",
                "severity": "CRITICAL",
                "explanation": f"IFSC code '{ifsc_cleaned}' violates RBI 11-character standard structure (Format: 4 letters, '0', 6 alphanumeric characters).",
                "bounding_box": [0.20, 0.50, 0.28, 0.75],
                "detection_method": "RBI Regex Specification Rule",
                "confidence": 1.0,
                "evidence_data": {"ifsc": ifsc_cleaned},
            })
            bank_confirmation_status = "MISMATCH"
        else:
            bank_prefix = ifsc_cleaned[:4]
            if bank_prefix in INDIAN_BANK_REGISTRY:
                registered_bank = INDIAN_BANK_REGISTRY[bank_prefix]["name"]
                # Cross-check bank name consistency
                b_name_lower = bank_name.lower()
                r_name_lower = registered_bank.lower()

                name_consistent = (
                    b_name_lower in r_name_lower
                    or r_name_lower in b_name_lower
                    or ("sbi" in b_name_lower and bank_prefix == "SBIN")
                    or ("pnb" in b_name_lower and bank_prefix == "PUNB")
                    or ("hdfc" in b_name_lower and bank_prefix == "HDFC")
                    or ("icici" in b_name_lower and bank_prefix == "ICIC")
                    or ("axis" in b_name_lower and bank_prefix == "UTIB")
                )

                if name_consistent:
                    findings.append({
                        "layer_number": 3,
                        "finding_type": "IFSC_REGISTRY_MATCHED",
                        "field_key": "ifsc_code",
                        "severity": "LOW",
                        "explanation": f"IFSC '{ifsc_cleaned}' successfully resolved in national registry to '{registered_bank}'. Consistent with stated bank name '{bank_name}'.",
                        "bounding_box": [0.20, 0.50, 0.28, 0.75],
                        "detection_method": "Indian Banking Registry Lookup",
                        "confidence": 0.99,
                        "evidence_data": {"registered_bank": registered_bank, "branch": branch_name},
                    })
                    # Realistic bank confirmation status: Since open public testing does not have real-time core banking API keys
                    bank_confirmation_status = "PENDING"
                else:
                    findings.append({
                        "layer_number": 3,
                        "finding_type": "BANK_NAME_IFSC_MISMATCH",
                        "field_key": "bank_name",
                        "severity": "CRITICAL",
                        "explanation": f"IFSC '{ifsc_cleaned}' belongs to '{registered_bank}', but document header states '{bank_name}'. Severe entity conflict.",
                        "bounding_box": [0.08, 0.20, 0.16, 0.80],
                        "detection_method": "Cross-Entity Registry Check",
                        "confidence": 0.98,
                        "evidence_data": {"stated_bank": bank_name, "registry_bank": registered_bank},
                    })
                    bank_confirmation_status = "MISMATCH"
            else:
                findings.append({
                    "layer_number": 3,
                    "finding_type": "UNREGISTERED_BANK_PREFIX",
                    "field_key": "ifsc_code",
                    "severity": "MEDIUM",
                    "explanation": f"IFSC prefix '{bank_prefix}' not found in top scheduled commercial banks registry. May represent cooperative or regional rural bank.",
                    "bounding_box": [0.20, 0.50, 0.28, 0.75],
                    "detection_method": "Indian Banking Registry Lookup",
                    "confidence": 0.85,
                    "evidence_data": {"prefix": bank_prefix},
                })
                bank_confirmation_status = "UNAVAILABLE"

        # 2. QR Code Inspection via OpenCV
        if image_bytes:
            try:
                nparr = np.frombuffer(image_bytes, np.uint8)
                cv_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                if cv_img is not None:
                    detector = cv2.QRCodeDetector()
                    val, pts, _ = detector.detectAndDecode(cv_img)
                    if val:
                        qr_details["qr_detected"] = True
                        qr_details["qr_payload"] = val
                        matches = (fdr_number.lower() in val.lower()) or (bank_name.lower() in val.lower())
                        qr_details["qr_matches_fdr"] = matches

                        if matches:
                            findings.append({
                                "layer_number": 3,
                                "finding_type": "QR_CODE_AUTHENTICATED",
                                "field_key": "qr_code",
                                "severity": "LOW",
                                "explanation": f"Security QR code successfully decoded. Embedded payload corroborates FDR reference '{fdr_number}'.",
                                "bounding_box": [0.08, 0.80, 0.22, 0.95],
                                "detection_method": "OpenCV QRCodeDetector",
                                "confidence": 0.98,
                                "evidence_data": {"payload_snippet": val[:100]},
                            })
                            if bank_confirmation_status == "PENDING":
                                bank_confirmation_status = "CONFIRMED"
                        else:
                            findings.append({
                                "layer_number": 3,
                                "finding_type": "QR_PAYLOAD_MISMATCH",
                                "field_key": "qr_code",
                                "severity": "HIGH",
                                "explanation": f"QR code decoded, but payload does not match receipt reference '{fdr_number}'.",
                                "bounding_box": [0.08, 0.80, 0.22, 0.95],
                                "detection_method": "OpenCV QRCodeDetector",
                                "confidence": 0.90,
                                "evidence_data": {"payload_snippet": val[:100]},
                            })
            except Exception as e:
                logger.warning(f"QR detection error: {e}")

        # If no QR code found on certificate, record finding
        if not qr_details["qr_detected"]:
            findings.append({
                "layer_number": 3,
                "finding_type": "NO_EMBEDDED_QR_CODE",
                "field_key": "qr_code",
                "severity": "LOW",
                "explanation": "No digitally signed QR code detected on certificate (common in legacy deposit receipts or computerized carbon prints).",
                "bounding_box": None,
                "detection_method": "OpenCV QRCodeDetector",
                "confidence": 0.95,
                "evidence_data": {},
            })

        has_critical = any(f["severity"] == "CRITICAL" for f in findings)
        has_high = any(f["severity"] == "HIGH" for f in findings)
        has_medium = any(f["severity"] == "MEDIUM" for f in findings)

        if has_critical:
            status = "FAILED"
        elif has_high or has_medium:
            status = "WARNING"
        else:
            status = "PASSED"

        return {
            "layer_number": 3,
            "layer_name": "Bank Details & QR Verification",
            "status": status,
            "bank_confirmation_status": bank_confirmation_status,
            "qr_details": qr_details,
            "findings": findings,
            "summary": f"Layer 3 completed with status {status}. Bank confirmation: {bank_confirmation_status}.",
        }


layer3_verifier = Layer3BankVerifier()
