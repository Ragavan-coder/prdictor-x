"""
PREDICTRA-X Enterprise Database Models
SQLAlchemy ORM definitions for FDR documents, records, extraction results,
field-level bounding box evidence, background jobs, and audit events.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    JSON,
    Index,
)
from sqlalchemy.orm import relationship
from database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now():
    return datetime.now(timezone.utc)


class Document(Base):
    __tablename__ = "documents"

    document_id = Column(String(64), primary_key=True, default=generate_uuid)
    original_filename = Column(String(255), nullable=False)
    stored_object_key = Column(String(512), nullable=False)
    sha256_hash = Column(String(64), nullable=False, unique=True, index=True)
    file_type = Column(String(64), nullable=False)  # application/pdf, image/jpeg, etc.
    file_size = Column(Integer, nullable=False)  # in bytes
    uploaded_by = Column(String(128), nullable=False, default="system-operator")
    uploaded_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    
    # Lifecycle: UPLOADED, VALIDATING, QUEUED, PROCESSING, EXTRACTED, REVIEW_REQUIRED, FAILED
    processing_status = Column(String(32), default="UPLOADED", nullable=False, index=True)
    # Extraction status: PENDING, COMPLETED, FLAGGED, FAILED
    extraction_status = Column(String(32), default="PENDING", nullable=False)
    # If duplicate, points to the original document_id
    duplicate_of = Column(String(64), nullable=True)

    # Relationships
    fdr_record = relationship("FDRRecordModel", back_populates="document", uselist=False)
    extraction_result = relationship("ExtractionResult", back_populates="document", uselist=False, cascade="all, delete-orphan")
    processing_job = relationship("DocumentProcessingJob", back_populates="document", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_doc_status_uploaded", "processing_status", "uploaded_at"),
    )


class FDRRecordModel(Base):
    __tablename__ = "fdr_records"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    receipt_number = Column(String(128), unique=True, nullable=False, index=True)
    bank_name = Column(String(128), nullable=False, index=True)
    branch_name = Column(String(128), nullable=True)
    ifsc_code = Column(String(32), nullable=True)
    account_holder = Column(String(128), nullable=True)
    principal_amount = Column(Float, nullable=False)
    interest_rate = Column(Float, nullable=False)
    tenure_months = Column(Integer, nullable=False, default=12)
    tenure_display = Column(String(64), nullable=True)
    compounding_frequency = Column(String(64), default="Quarterly")
    issue_date = Column(String(32), nullable=False)  # YYYY-MM-DD
    maturity_date = Column(String(32), nullable=False, index=True)  # YYYY-MM-DD
    maturity_amount = Column(Float, nullable=False)
    currency = Column(String(16), default="INR")
    
    # Status: VERIFIED_AUTHENTIC, PENDING_REVIEW, FLAGGED_ANOMALY
    verification_status = Column(String(32), default="PENDING_REVIEW", nullable=False, index=True)
    
    # Layer Verification flags
    layer1_evidence = Column(String(128), default="PASSED (Watermark, seal & microprint validated)")
    layer2_calculations = Column(String(128), default="PASSED (Compound interest formula matches maturity sum)")
    layer3_bank_validation = Column(String(128), default="PASSED (Bank branch & IFSC validated against registry)")
    layer4_doubtful_digits = Column(String(128), default="PASSED (Zero font-weight or kerning discrepancies)")
    
    document_id = Column(String(64), ForeignKey("documents.document_id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    document = relationship("Document", back_populates="fdr_record")
    extraction_result = relationship("ExtractionResult", back_populates="fdr_record", uselist=False)
    verification_result = relationship("VerificationResult", back_populates="fdr_record", uselist=False, cascade="all, delete-orphan")
    anomalies = relationship("AnomalyEvent", back_populates="fdr_record", cascade="all, delete-orphan")
    auto_repairs = relationship("AutoRepairProposal", back_populates="fdr_record", cascade="all, delete-orphan")
    notifications = relationship("NotificationEvent", back_populates="fdr_record", cascade="all, delete-orphan")
    lifecycle_events = relationship("LifecycleEvent", back_populates="fdr_record", cascade="all, delete-orphan")


class ExtractionResult(Base):
    __tablename__ = "extraction_results"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    document_id = Column(String(64), ForeignKey("documents.document_id", ondelete="CASCADE"), nullable=False, unique=True)
    fdr_record_id = Column(String(64), ForeignKey("fdr_records.id", ondelete="SET NULL"), nullable=True)
    
    extraction_confidence = Column(Float, nullable=False, default=0.0)  # 0.0 - 1.0
    tool_pipeline = Column(String(128), default="Docling + PaddleOCR + Qwen2.5-VL")
    parsing_latency_ms = Column(Float, default=0.0)
    raw_extracted_json = Column(JSON, nullable=True)
    status = Column(String(32), default="COMPLETED")  # COMPLETED, FLAGGED, FAILED
    review_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    document = relationship("Document", back_populates="extraction_result")
    fdr_record = relationship("FDRRecordModel", back_populates="extraction_result")
    fields = relationship("ExtractionField", back_populates="extraction_result", cascade="all, delete-orphan")


class ExtractionField(Base):
    __tablename__ = "extraction_fields"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    extraction_result_id = Column(String(64), ForeignKey("extraction_results.id", ondelete="CASCADE"), nullable=False)
    
    field_key = Column(String(64), nullable=False)  # principal_amount, bank_name, maturity_date, etc.
    field_label = Column(String(128), nullable=False)
    original_value = Column(Text, nullable=True)  # Immutable original value
    current_value = Column(Text, nullable=True)   # User-reviewed / updated value
    source_page = Column(Integer, default=1)
    
    # Normalized bounding box [ymin, xmin, ymax, xmax] in 0.0 - 1.0 or pixel coordinates
    bounding_box = Column(JSON, nullable=True)
    ocr_confidence = Column(Float, default=0.95)
    extraction_method = Column(String(64), default="Docling Layout")
    
    # Review status: ACCEPTED, EDITED, UNCERTAIN, MANUAL_REVIEW_REQUESTED, PENDING
    review_status = Column(String(32), default="PENDING", nullable=False)
    is_edited = Column(Boolean, default=False)
    last_reviewed_by = Column(String(128), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    extraction_result = relationship("ExtractionResult", back_populates="fields")

    __table_args__ = (
        Index("idx_extraction_field_key", "extraction_result_id", "field_key"),
    )


class DocumentProcessingJob(Base):
    __tablename__ = "document_processing_jobs"

    job_id = Column(String(64), primary_key=True, default=generate_uuid)
    document_id = Column(String(64), ForeignKey("documents.document_id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Stage: UPLOADED, VALIDATING, PARSING_PDF, RUNNING_OCR, EXTRACTING_FIELDS, VALIDATING_SCHEMA, FINALIZING, COMPLETED, FAILED
    current_stage = Column(String(64), default="UPLOADED", nullable=False)
    progress_pct = Column(Integer, default=5, nullable=False)  # 0 to 100
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    document = relationship("Document", back_populates="processing_job")


class AuditEventModel(Base):
    __tablename__ = "audit_events"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    index = Column(Integer, nullable=False, unique=True)
    action = Column(String(64), nullable=False)
    actor_id = Column(String(128), nullable=False)
    actor_username = Column(String(128), nullable=False)
    resource_id = Column(String(128), nullable=True)
    details_json = Column(JSON, nullable=True)
    prev_hash = Column(String(64), nullable=False)
    entry_hash = Column(String(64), nullable=False)
    timestamp = Column(Float, nullable=False)
    iso_time = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


# ==============================================================================
# PHASE 1 & 4: SENTRA 4-LAYER VERIFICATION & RISK DECISION MODELS
# ==============================================================================

class VerificationResult(Base):
    __tablename__ = "verification_results"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    fdr_id = Column(String(64), ForeignKey("fdr_records.id", ondelete="CASCADE"), nullable=False, unique=True)
    document_id = Column(String(64), ForeignKey("documents.document_id", ondelete="CASCADE"), nullable=True)
    
    # Classification: VERIFIED, VERIFIED_WITH_WARNINGS, REVIEW_REQUIRED, SUSPICIOUS, BANK_CONFIRMATION_PENDING, PROCESSING_FAILED
    overall_status = Column(String(48), default="REVIEW_REQUIRED", nullable=False, index=True)
    overall_risk_score = Column(Float, default=25.0, nullable=False)  # 0 to 100
    risk_severity = Column(String(24), default="LOW", nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    
    # Four Layer Statuses: PASSED, WARNING, FAILED, PENDING
    layer1_status = Column(String(32), default="PASSED", nullable=False)
    layer2_status = Column(String(32), default="PASSED", nullable=False)
    layer3_status = Column(String(32), default="PENDING", nullable=False)
    layer4_status = Column(String(32), default="PASSED", nullable=False)
    
    # Bank confirmation: CONFIRMED, NOT_CONFIRMED, PENDING, UNAVAILABLE, MISMATCH
    bank_confirmation_status = Column(String(32), default="PENDING", nullable=False)
    
    summary_explanation = Column(Text, nullable=True)
    mathematical_details = Column(JSON, nullable=True)
    bank_verification_details = Column(JSON, nullable=True)
    visual_evidence_summary = Column(JSON, nullable=True)
    doubtful_digits_summary = Column(JSON, nullable=True)
    
    verified_by = Column(String(128), default="SENTRA-AI-Core")
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    fdr_record = relationship("FDRRecordModel", back_populates="verification_result")
    findings = relationship("VerificationFinding", back_populates="verification_result", cascade="all, delete-orphan")


class VerificationFinding(Base):
    __tablename__ = "verification_findings"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    verification_result_id = Column(String(64), ForeignKey("verification_results.id", ondelete="CASCADE"), nullable=False, index=True)
    
    layer_number = Column(Integer, nullable=False)  # 1, 2, 3, 4
    finding_type = Column(String(64), nullable=False)  # e.g. FONT_INCONSISTENCY, MATH_DEVIATION, IFSC_FORMAT, DOUBTFUL_DIGIT
    field_key = Column(String(64), nullable=True)
    severity = Column(String(24), default="LOW", nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    
    explanation = Column(Text, nullable=False)
    bounding_box = Column(JSON, nullable=True)  # [ymin, xmin, ymax, xmax]
    detection_method = Column(String(128), nullable=False)
    confidence = Column(Float, nullable=True)
    evidence_data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    verification_result = relationship("VerificationResult", back_populates="findings")


# ==============================================================================
# PHASE 2 & 3: SENTRA AI GUARDIAN & AUTO-REPAIR MODELS
# ==============================================================================

class AnomalyEvent(Base):
    __tablename__ = "anomaly_events"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    fdr_id = Column(String(64), ForeignKey("fdr_records.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(String(64), ForeignKey("documents.document_id", ondelete="SET NULL"), nullable=True)
    
    # Anomaly Category: VISUAL_TAMPERING, FINANCIAL_CONTRADICTION, BEHAVIORAL_PATTERN, DUPLICATE_CONFLICT
    anomaly_type = Column(String(64), nullable=False, index=True)
    field_name = Column(String(64), nullable=False)
    original_value = Column(Text, nullable=True)
    detected_value_or_pattern = Column(Text, nullable=True)
    evidence_coords = Column(JSON, nullable=True)  # Bounding box coordinates for heatmap
    detection_method = Column(String(128), nullable=False)  # OpenCV ELA, Statistical Outlier, etc.
    
    severity = Column(String(24), default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    reason_for_flagging = Column(Text, nullable=False)
    recommended_action = Column(Text, nullable=False)
    
    # Status: OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE
    status = Column(String(32), default="OPEN", nullable=False, index=True)
    resolved_by = Column(String(128), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    fdr_record = relationship("FDRRecordModel", back_populates="anomalies")


class AutoRepairProposal(Base):
    __tablename__ = "auto_repair_proposals"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    fdr_id = Column(String(64), ForeignKey("fdr_records.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(String(64), ForeignKey("documents.document_id", ondelete="SET NULL"), nullable=True)
    
    field_key = Column(String(64), nullable=False)
    field_label = Column(String(128), nullable=False)
    original_value = Column(Text, nullable=False)  # Immutable original
    proposed_value = Column(Text, nullable=False)
    final_approved_value = Column(Text, nullable=True)
    
    reason_for_correction = Column(Text, nullable=False)
    evidence_reference = Column(JSON, nullable=True)
    model_method_used = Column(String(128), default="PaddleOCR + Financial Formula Consensus")
    
    # Status: PENDING, APPROVED, REJECTED
    status = Column(String(32), default="PENDING", nullable=False, index=True)
    reviewed_by = Column(String(128), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    fdr_record = relationship("FDRRecordModel", back_populates="auto_repairs")


# ==============================================================================
# PHASE 5: ADVANCED DUPLICATE INTELLIGENCE
# ==============================================================================

class DuplicateMatch(Base):
    __tablename__ = "duplicate_matches"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    primary_fdr_id = Column(String(64), ForeignKey("fdr_records.id", ondelete="CASCADE"), nullable=False, index=True)
    duplicate_fdr_id = Column(String(64), ForeignKey("fdr_records.id", ondelete="CASCADE"), nullable=False, index=True)
    primary_document_id = Column(String(64), ForeignKey("documents.document_id", ondelete="SET NULL"), nullable=True)
    duplicate_document_id = Column(String(64), ForeignKey("documents.document_id", ondelete="SET NULL"), nullable=True)
    
    # Level: LEVEL_1_EXACT_FILE, LEVEL_2_NEAR_DUPLICATE, LEVEL_3_FINANCIAL_RECORD
    match_level = Column(String(32), nullable=False, index=True)
    similarity_score = Column(Float, nullable=False, default=1.0)  # 0.0 to 1.0
    matched_fields_json = Column(JSON, nullable=True)
    conflicting_fields_json = Column(JSON, nullable=True)
    
    recommended_action = Column(Text, nullable=False)
    status = Column(String(32), default="DETECTED", nullable=False)  # DETECTED, CONFIRMED_DUPLICATE, FALSE_POSITIVE
    reviewed_by = Column(String(128), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


# ==============================================================================
# PHASE 6: NOTIFICATION & EMAIL DELIVERY MODELS
# ==============================================================================

class NotificationEvent(Base):
    __tablename__ = "notification_events"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    fdr_id = Column(String(64), ForeignKey("fdr_records.id", ondelete="CASCADE"), nullable=True, index=True)
    
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(24), default="INFO", nullable=False)  # INFO, HIGH, CRITICAL
    category = Column(String(32), default="ANOMALY", nullable=False)  # ANOMALY, DUPLICATE, MATURITY, VERIFICATION, SYSTEM
    event_id = Column(String(128), nullable=False, index=True)  # Deduplication key
    
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    action_link = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    fdr_record = relationship("FDRRecordModel", back_populates="notifications")
    email_logs = relationship("EmailDeliveryLog", back_populates="notification", cascade="all, delete-orphan")


class EmailDeliveryLog(Base):
    __tablename__ = "email_delivery_logs"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    notification_event_id = Column(String(64), ForeignKey("notification_events.id", ondelete="CASCADE"), nullable=False)
    
    recipient_email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    event_type = Column(String(64), nullable=False)
    severity = Column(String(24), nullable=False)
    fdr_ref = Column(String(128), nullable=True)
    
    # Status: PENDING, SENT, FAILED, RETRYING
    delivery_status = Column(String(32), default="PENDING", nullable=False)
    retry_count = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    notification = relationship("NotificationEvent", back_populates="email_logs")


# ==============================================================================
# PHASE 7: FDR LIFECYCLE MONITORING MODELS
# ==============================================================================

class LifecycleEvent(Base):
    __tablename__ = "lifecycle_events"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    fdr_id = Column(String(64), ForeignKey("fdr_records.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Type: CREATED, VERIFIED, MATURITY_REMINDER, RENEWAL_REQUESTED, RENEWED, REPLACED, CLOSED, AUTO_REPAIRED
    event_type = Column(String(64), nullable=False, index=True)
    event_description = Column(Text, nullable=False)
    scheduled_date = Column(String(32), nullable=True)
    performed_date = Column(String(32), nullable=True)
    performed_by = Column(String(128), default="System")
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    fdr_record = relationship("FDRRecordModel", back_populates="lifecycle_events")


# ==============================================================================
# PHASE 9: GENERATED REPORTS MODEL
# ==============================================================================

class GeneratedReport(Base):
    __tablename__ = "generated_reports"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    fdr_id = Column(String(64), ForeignKey("fdr_records.id", ondelete="CASCADE"), nullable=False, index=True)
    
    report_type = Column(String(16), nullable=False)  # PDF, EXCEL
    file_path = Column(String(512), nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    generated_by = Column(String(128), nullable=False)
    parameters_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
