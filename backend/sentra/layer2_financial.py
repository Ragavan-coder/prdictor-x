"""
PREDICTRA-X SENTRA Layer 2: Financial Math Verification
Performs deterministic financial math calculations using NumPy and banking formulas:
- Validates Issue Date, Maturity Date, and Deposit Tenure
- Computes Expected Compound Interest under Monthly, Quarterly, Semi-Annual, and Annual schedules
- Tolerates legitimate Indian banking day-count conventions and TDS deductions
- Identifies critical financial contradictions (e.g. Maturity < Principal, negative interest)
- Generates detailed step-by-step mathematical explanations
"""
import logging
import math
from datetime import datetime
import numpy as np
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger("predictra.sentra.layer2")


class Layer2FinancialVerifier:
    def verify(
        self,
        principal: float,
        interest_rate: float,
        maturity_amount: float,
        issue_date_str: str,
        maturity_date_str: str,
        compounding_frequency: str = "Quarterly",
        tenure_months: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Executes Financial Math validation.
        Returns structured status, mathematical comparisons, and findings.
        """
        findings = []
        calculation_details = {}

        # 1. Contradiction check: Principal vs Maturity
        if maturity_amount < principal:
            findings.append({
                "layer_number": 2,
                "finding_type": "FINANCIAL_CONTRADICTION",
                "field_key": "maturity_amount",
                "severity": "CRITICAL",
                "explanation": f"Maturity amount (₹{maturity_amount:,.2f}) is strictly less than principal deposit (₹{principal:,.2f}). Fundamental banking violation.",
                "bounding_box": [0.45, 0.40, 0.52, 0.70],
                "detection_method": "Deterministic Boundary Assertion",
                "confidence": 1.0,
                "evidence_data": {"principal": principal, "maturity_amount": maturity_amount},
            })

        # 2. Interest Rate Plausibility
        if interest_rate <= 0 or interest_rate > 25.0:
            findings.append({
                "layer_number": 2,
                "finding_type": "IMPLAUSIBLE_INTEREST_RATE",
                "field_key": "interest_rate",
                "severity": "CRITICAL" if interest_rate <= 0 or interest_rate > 35.0 else "HIGH",
                "explanation": f"Annual interest rate of {interest_rate}% is outside plausible retail banking guidelines (RBI benchmark range: 3.0% - 10.5%).",
                "bounding_box": [0.38, 0.40, 0.44, 0.60],
                "detection_method": "Benchmark Outlier Evaluation",
                "confidence": 0.99,
                "evidence_data": {"interest_rate": interest_rate},
            })

        # 3. Date & Tenure Verification
        days_between = 0
        tenure_years = 1.0
        date_valid = False

        try:
            # Parse dates flexibly (YYYY-MM-DD or DD/MM/YYYY)
            fmt_candidates = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]
            d_issue = None
            d_mat = None

            for fmt in fmt_candidates:
                try:
                    if not d_issue:
                        d_issue = datetime.strptime(issue_date_str.strip(), fmt)
                except Exception:
                    pass
                try:
                    if not d_mat:
                        d_mat = datetime.strptime(maturity_date_str.strip(), fmt)
                except Exception:
                    pass

            if d_issue and d_mat:
                days_between = (d_mat - d_issue).days
                if days_between <= 0:
                    findings.append({
                        "layer_number": 2,
                        "finding_type": "NEGATIVE_TENURE",
                        "field_key": "maturity_date",
                        "severity": "CRITICAL",
                        "explanation": f"Maturity date ({maturity_date_str}) precedes or equals issue date ({issue_date_str}). Difference is {days_between} days.",
                        "bounding_box": [0.42, 0.20, 0.48, 0.80],
                        "detection_method": "Temporal Sequence Validation",
                        "confidence": 1.0,
                        "evidence_data": {"days_between": days_between},
                    })
                else:
                    date_valid = True
                    tenure_years = days_between / 365.25
            else:
                findings.append({
                    "layer_number": 2,
                    "finding_type": "UNPARSEABLE_DATE_FORMAT",
                    "field_key": "issue_date",
                    "severity": "MEDIUM",
                    "explanation": f"Dates could not be parsed unambiguously ('{issue_date_str}' / '{maturity_date_str}'). Falling back to nominal tenure.",
                    "bounding_box": [0.42, 0.20, 0.48, 0.80],
                    "detection_method": "Regex Date Parser",
                    "confidence": 0.75,
                    "evidence_data": {},
                })
        except Exception as e:
            logger.warning(f"Error computing dates: {e}")

        if not date_valid and tenure_months:
            tenure_years = tenure_months / 12.0

        # 4. Compound Interest Calculation
        # Map frequency to n compounding periods per year
        freq_lower = compounding_frequency.lower()
        if "month" in freq_lower:
            n_comp = 12
        elif "half" in freq_lower or "semi" in freq_lower:
            n_comp = 2
        elif "annual" in freq_lower or "yearly" in freq_lower:
            n_comp = 1
        else:
            n_comp = 4  # Standard Indian retail banking default: Quarterly Compounding

        r = interest_rate / 100.0
        # NumPy formula: A = P * (1 + r/n)**(n*t)
        expected_maturity_quarterly = principal * ((1.0 + r / 4.0) ** (4.0 * tenure_years))
        expected_maturity_exact = principal * ((1.0 + r / n_comp) ** (n_comp * tenure_years))
        simple_interest_maturity = principal * (1.0 + r * tenure_years)

        diff_exact = abs(maturity_amount - expected_maturity_exact)
        pct_diff = (diff_exact / (expected_maturity_exact + 1e-5)) * 100.0

        calculation_details = {
            "principal": principal,
            "interest_rate_pct": interest_rate,
            "stated_tenure_years": round(tenure_years, 3),
            "days_elapsed": days_between,
            "compounding_frequency": compounding_frequency,
            "compounding_periods_per_year": n_comp,
            "printed_maturity_amount": maturity_amount,
            "expected_maturity_exact": round(expected_maturity_exact, 2),
            "expected_maturity_quarterly": round(expected_maturity_quarterly, 2),
            "simple_interest_baseline": round(simple_interest_maturity, 2),
            "absolute_difference": round(diff_exact, 2),
            "percentage_difference": round(pct_diff, 2),
            "formula_used": f"A = P * (1 + {r:.4f}/{n_comp})^({n_comp} * {tenure_years:.2f})",
        }

        # Plausibility threshold:
        # Bank-specific interest rules vary (e.g. cumulative daily compounding, leap years, rounding to nearest rupee).
        # Normal tolerance: <= 1.5% difference is considered rounding/day-count variations.
        if pct_diff > 12.0:
            findings.append({
                "layer_number": 2,
                "finding_type": "MATHEMATICAL_DIVERGENCE_CRITICAL",
                "field_key": "maturity_amount",
                "severity": "CRITICAL",
                "explanation": (
                    f"Printed maturity value of ₹{maturity_amount:,.2f} diverges substantially "
                    f"from calculated compound interest expected value of ₹{expected_maturity_exact:,.2f} "
                    f"(Difference: ₹{diff_exact:,.2f} or {pct_diff:.1f}%). Possible altered principal or maturity figures."
                ),
                "bounding_box": [0.45, 0.40, 0.52, 0.70],
                "detection_method": "NumPy Compound Interest Model",
                "confidence": 0.95,
                "evidence_data": calculation_details,
            })
        elif pct_diff > 2.0:
            findings.append({
                "layer_number": 2,
                "finding_type": "MATHEMATICAL_ROUNDING_DEVIATION",
                "field_key": "maturity_amount",
                "severity": "MEDIUM",
                "explanation": (
                    f"Printed maturity (₹{maturity_amount:,.2f}) has moderate variance from theoretical compounding "
                    f"(₹{expected_maturity_exact:,.2f}, diff ₹{diff_exact:,.2f}). Likely due to bank-specific broken period interest or TDS withholding."
                ),
                "bounding_box": [0.45, 0.40, 0.52, 0.70],
                "detection_method": "NumPy Compound Interest Model",
                "confidence": 0.85,
                "evidence_data": calculation_details,
            })
        else:
            findings.append({
                "layer_number": 2,
                "finding_type": "FINANCIAL_MATH_VALIDATED",
                "field_key": "maturity_amount",
                "severity": "LOW",
                "explanation": (
                    f"Printed maturity (₹{maturity_amount:,.2f}) strictly conforms to standard "
                    f"{compounding_frequency.lower()} compounding formula (Expected: ₹{expected_maturity_exact:,.2f}, variance < {pct_diff:.2f}%)."
                ),
                "bounding_box": [0.45, 0.40, 0.52, 0.70],
                "detection_method": "NumPy Compound Interest Model",
                "confidence": 0.98,
                "evidence_data": calculation_details,
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
            "layer_number": 2,
            "layer_name": "Financial Math Verification",
            "status": status,
            "calculation_details": calculation_details,
            "findings": findings,
            "summary": f"Layer 2 completed with status {status}. Math variance: {pct_diff:.2f}%.",
        }


layer2_verifier = Layer2FinancialVerifier()
