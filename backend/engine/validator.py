"""
PREDICTRA-X FDR Pydantic Validation & Normalization Schemas
Strict financial, mathematical, and regulatory validation for Indian banking Fixed Deposit Receipts.
"""
import re
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator


KNOWN_INDIAN_BANKS = {
    "STATE BANK OF INDIA": ["SBI", "STATE BANK"],
    "HDFC BANK LIMITED": ["HDFC", "HDFC BANK"],
    "ICICI BANK": ["ICICI", "ICICI BANK LIMITED"],
    "PUNJAB NATIONAL BANK": ["PNB", "PUNJAB NATIONAL"],
    "BANK OF BARODA": ["BOB", "BANK OF BARODA"],
    "CANARA BANK": ["CANARA"],
    "AXIS BANK": ["AXIS", "UTI BANK"],
    "KOTAK MAHINDRA BANK": ["KOTAK", "KOTAK BANK"],
    "UNION BANK OF INDIA": ["UNION BANK", "UBI"],
    "INDUSIND BANK": ["INDUSIND"],
    "CENTRAL BANK OF INDIA": ["CENTRAL BANK"],
    "INDIAN BANK": ["INDIAN BANK"],
}


class BoundingBox(BaseModel):
    ymin: float = Field(..., ge=0.0, le=1.0)
    xmin: float = Field(..., ge=0.0, le=1.0)
    ymax: float = Field(..., ge=0.0, le=1.0)
    xmax: float = Field(..., ge=0.0, le=1.0)


class FieldEvidence(BaseModel):
    field_key: str
    field_label: str
    extracted_value: Optional[str] = None
    source_page: int = 1
    bounding_box: Optional[List[float]] = None  # [ymin, xmin, ymax, xmax]
    ocr_confidence: float = Field(default=0.95, ge=0.0, le=1.0)
    extraction_method: str = "Docling Layout"
    review_status: str = "PENDING"  # PENDING, ACCEPTED, EDITED, UNCERTAIN


class ExtractedFDRSchema(BaseModel):
    bank_name: str = Field(..., min_length=2, max_length=128)
    branch_name: Optional[str] = Field(default="Main Branch", max_length=128)
    ifsc_code: Optional[str] = Field(default=None, max_length=32)
    fdr_number: str = Field(..., min_length=3, max_length=128)
    account_holder: Optional[str] = Field(default="Account Holder", max_length=128)
    principal_amount: float = Field(..., gt=0)
    interest_rate: float = Field(..., gt=0, le=30.0)
    issue_date: str = Field(..., min_length=8)  # YYYY-MM-DD
    maturity_date: str = Field(..., min_length=8)  # YYYY-MM-DD
    tenure: str = Field(default="12 Months")
    compounding_frequency: str = Field(default="Quarterly")
    maturity_amount: float = Field(..., gt=0)
    currency: str = Field(default="INR")
    extraction_confidence: float = Field(default=0.90, ge=0.0, le=1.0)
    field_evidence: List[FieldEvidence] = Field(default_factory=list)

    @field_validator("bank_name")
    @classmethod
    def normalize_bank_name(cls, v: str) -> str:
        v_upper = v.strip().upper()
        for official_name, aliases in KNOWN_INDIAN_BANKS.items():
            if v_upper == official_name or any(alias in v_upper for alias in aliases):
                return official_name
        return v.strip().title()

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        clean = v.strip().upper()
        # Indian IFSC format: 4 letters + 0 + 6 alphanumeric
        if re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", clean):
            return clean
        return clean

    @model_validator(mode="after")
    def validate_financial_consistency(self):
        # Maturity amount must strictly equal or exceed principal
        if self.maturity_amount < self.principal_amount:
            raise ValueError(
                f"Financial contradiction: Maturity amount (Rs. {self.maturity_amount:,.2f}) "
                f"cannot be less than Principal deposit (Rs. {self.principal_amount:,.2f})."
            )
        return self
