"""
PREDICTRA-X FDR Document Upload & Universal Reading Engine API Routes
Handles secure file uploads, magic byte validation, SHA-256 duplicate detection,
asynchronous reading job tracking, document previews, and field-level evidence review.
"""
import os
import asyncio
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    status,
    Query,
    Response,
)
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db, get_db_context
from models import (
    Document,
    FDRRecordModel,
    ExtractionResult,
    ExtractionField,
    DocumentProcessingJob,
)
from auth import AuthenticatedUser, get_current_user
from audit import audit_log
from storage import storage_service, StorageValidationException
from engine.pipeline import pipeline

logger = logging.getLogger("predictra.routes.documents")

router = APIRouter(prefix="/api/documents", tags=["Document Lifecycle & Universal Reading Engine"])


# ------------------------------------------------------------------------------
# Schemas
# ------------------------------------------------------------------------------
class FieldReviewItem(BaseModel):
    field_key: str
    new_value: Optional[str] = None
    review_status: str = Field(..., example="ACCEPTED")  # ACCEPTED, EDITED, UNCERTAIN, MANUAL_REVIEW_REQUESTED
    notes: Optional[str] = None


class BatchFieldReviewRequest(BaseModel):
    fields: List[FieldReviewItem]
    reviewer_notes: Optional[str] = None


# ------------------------------------------------------------------------------
# 1. POST /api/documents/upload - Secure Document Upload Center
# ------------------------------------------------------------------------------
@router.post("/upload", summary="Upload FDR Document with SHA-256 Duplicate Check & Magic Byte Validation")
async def upload_document(
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Validates file extension, MIME type, and magic bytes.
    Calculates SHA-256 hash. Rejects corrupted or empty files.
    Detects duplicates and returns existing document reference if duplicate.
    Stores unmodified original document and enqueues background reading engine job.
    """
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed reading file: {e}")

    filename = file.filename or "fdr_document.pdf"
    content_type = file.content_type

    # 1. Validate file extension, size, and magic byte signature
    try:
        detected_type, ext = storage_service.validate_file(filename, content, content_type)
    except StorageValidationException as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )

    # 2. SHA-256 Cryptographic Hash Check
    import hashlib
    sha256_hash = hashlib.sha256(content).hexdigest()

    existing_doc = db.query(Document).filter(Document.sha256_hash == sha256_hash).first()
    if existing_doc:
        # Prompt user with duplicate reference - do not silently duplicate
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "is_duplicate": True,
                "message": "Duplicate document detected. A file with this exact SHA-256 cryptographic digest has already been processed.",
                "existing_document_id": existing_doc.document_id,
                "original_filename": existing_doc.original_filename,
                "uploaded_at": existing_doc.uploaded_at.isoformat() if existing_doc.uploaded_at else None,
                "sha256_hash": sha256_hash,
            },
        )

    # 3. Store Original Document without alteration
    try:
        object_key, sha256_digest, file_size, verified_type = storage_service.store_document(
            filename=filename,
            content=content,
            declared_mime=detected_type,
        )
    except Exception as se:
        logger.error(f"Storage error saving file {filename}: {se}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Storage backend failure.")

    # 4. Create Document Record in PostgreSQL
    new_doc = Document(
        original_filename=filename,
        stored_object_key=object_key,
        sha256_hash=sha256_digest,
        file_type=verified_type,
        file_size=file_size,
        uploaded_by=user.username,
        processing_status="QUEUED",
        extraction_status="PENDING",
    )
    db.add(new_doc)
    db.flush()

    # 5. Initialize DocumentProcessingJob
    job = DocumentProcessingJob(
        document_id=new_doc.document_id,
        current_stage="QUEUED",
        progress_pct=10,
    )
    db.add(job)
    db.commit()
    db.refresh(new_doc)

    # 6. Record in Cryptographic Audit Log
    audit_log.record(
        action="DOCUMENT_UPLOADED",
        actor_id=user.id,
        actor_username=user.username,
        resource_id=new_doc.document_id,
        details={
            "filename": filename,
            "sha256": sha256_digest,
            "file_size": file_size,
            "file_type": verified_type,
            "object_key": object_key,
        },
    )

    # 7. Spawn Async Background Processing Job
    asyncio.create_task(pipeline.process_document_job(new_doc.document_id))

    return {
        "success": True,
        "message": "Document uploaded successfully and queued for Universal Reading Engine processing.",
        "document": {
            "document_id": new_doc.document_id,
            "original_filename": new_doc.original_filename,
            "file_type": new_doc.file_type,
            "file_size": new_doc.file_size,
            "sha256_hash": new_doc.sha256_hash,
            "processing_status": new_doc.processing_status,
            "uploaded_at": new_doc.uploaded_at.isoformat() if new_doc.uploaded_at else None,
        },
    }


# ------------------------------------------------------------------------------
# 2. GET /api/documents - List Documents with Pagination & Filters
# ------------------------------------------------------------------------------
@router.get("", summary="List FDR Documents with Pagination and Status Filters")
def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Document)
    if status:
        query = query.filter(Document.processing_status == status)
    if search:
        query = query.filter(Document.original_filename.ilike(f"%{search}%"))

    total = query.count()
    docs = query.order_by(Document.uploaded_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for d in docs:
        job = d.processing_job
        items.append({
            "document_id": d.document_id,
            "original_filename": d.original_filename,
            "file_type": d.file_type,
            "file_size": d.file_size,
            "sha256_hash": d.sha256_hash,
            "uploaded_by": d.uploaded_by,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            "processing_status": d.processing_status,
            "extraction_status": d.extraction_status,
            "progress_pct": job.progress_pct if job else 100,
            "current_stage": job.current_stage if job else d.processing_status,
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "documents": items,
    }


# ------------------------------------------------------------------------------
# 3. GET /api/documents/{document_id} - Document Metadata
# ------------------------------------------------------------------------------
@router.get("/{document_id}", summary="Get Document Metadata and Processing Status")
def get_document_details(
    document_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.document_id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    job = doc.processing_job
    fdr = doc.fdr_record

    return {
        "document_id": doc.document_id,
        "original_filename": doc.original_filename,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "sha256_hash": doc.sha256_hash,
        "uploaded_by": doc.uploaded_by,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        "processing_status": doc.processing_status,
        "extraction_status": doc.extraction_status,
        "job": {
            "current_stage": job.current_stage if job else doc.processing_status,
            "progress_pct": job.progress_pct if job else 100,
            "error_message": job.error_message if job else None,
            "completed_at": job.completed_at.isoformat() if job and job.completed_at else None,
        } if job else None,
        "fdr_record": {
            "id": fdr.id,
            "receipt_number": fdr.receipt_number,
            "bank_name": fdr.bank_name,
            "principal_amount": fdr.principal_amount,
            "maturity_amount": fdr.maturity_amount,
            "verification_status": fdr.verification_status,
        } if fdr else None,
    }


# ------------------------------------------------------------------------------
# 4. GET /api/documents/{document_id}/status - Real-Time Job Progress
# ------------------------------------------------------------------------------
@router.get("/{document_id}/status", summary="Real-Time Processing Job Progress & Status")
def get_processing_status(
    document_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.document_id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    job = doc.processing_job
    progress = job.progress_pct if job else (100 if doc.processing_status == "EXTRACTED" else 10)
    current_stage = job.current_stage if job else doc.processing_status
    error = job.error_message if job else None

    # Never display 100% until actually finished
    if doc.processing_status not in ["EXTRACTED", "COMPLETED", "FAILED"] and progress >= 100:
        progress = 99

    return {
        "document_id": doc.document_id,
        "processing_status": doc.processing_status,
        "current_stage": current_stage,
        "progress_pct": progress,
        "error_message": error,
        "completed": doc.processing_status in ["EXTRACTED", "COMPLETED", "FAILED"],
    }


# ------------------------------------------------------------------------------
# 5. GET /api/documents/{document_id}/preview - Secure Preview Stream
# ------------------------------------------------------------------------------
@router.get("/{document_id}/preview", summary="Stream or Preview Uploaded Document")
def preview_document(
    document_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Streams the raw unmodified document bytes with inline Content-Disposition for browser display."""
    doc = db.query(Document).filter(Document.document_id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    try:
        content = storage_service.get_document_bytes(doc.stored_object_key)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document bytes missing from storage.")

    return Response(
        content=content,
        media_type=doc.file_type,
        headers={
            "Content-Disposition": f'inline; filename="{doc.original_filename}"',
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )


# ------------------------------------------------------------------------------
# 6. POST /api/documents/{document_id}/process - Trigger / Re-run Pipeline
# ------------------------------------------------------------------------------
@router.post("/{document_id}/process", summary="Trigger or Re-run Universal Reading Engine Processing")
def trigger_process_document(
    document_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.document_id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Update job
    job = doc.processing_job
    if not job:
        job = DocumentProcessingJob(document_id=doc.document_id, current_stage="QUEUED", progress_pct=10)
        db.add(job)
    else:
        job.current_stage = "QUEUED"
        job.progress_pct = 10
        job.error_message = None
        job.completed_at = None

    doc.processing_status = "QUEUED"
    db.commit()

    # Launch task
    asyncio.create_task(pipeline.process_document_job(document_id))

    return {
        "success": True,
        "message": f"Universal Reading Engine initiated for Document {document_id}",
    }


# ------------------------------------------------------------------------------
# 7. GET /api/documents/{document_id}/extraction - Extracted Data & Bounding Box Evidence
# ------------------------------------------------------------------------------
@router.get("/{document_id}/extraction", summary="Get Extracted FDR Data and Spatial Bounding Box Evidence")
def get_document_extraction(
    document_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.document_id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    ext_res = doc.extraction_result
    if not ext_res:
        return {
            "document_id": doc.document_id,
            "status": doc.processing_status,
            "has_extraction": False,
            "message": "Extraction has not completed for this document yet.",
        }

    fields = db.query(ExtractionField).filter(ExtractionField.extraction_result_id == ext_res.id).all()

    field_list = []
    for f in fields:
        field_list.append({
            "id": f.id,
            "field_key": f.field_key,
            "field_label": f.field_label,
            "original_value": f.original_value,
            "current_value": f.current_value,
            "source_page": f.source_page,
            "bounding_box": f.bounding_box,  # [ymin, xmin, ymax, xmax]
            "ocr_confidence": f.ocr_confidence,
            "extraction_method": f.extraction_method,
            "review_status": f.review_status,
            "is_edited": f.is_edited,
            "last_reviewed_by": f.last_reviewed_by,
        })

    fdr = doc.fdr_record

    return {
        "document_id": doc.document_id,
        "extraction_id": ext_res.id,
        "status": ext_res.status,
        "extraction_confidence": ext_res.extraction_confidence,
        "tool_pipeline": ext_res.tool_pipeline,
        "parsing_latency_ms": ext_res.parsing_latency_ms,
        "fdr_record": {
            "id": fdr.id if fdr else None,
            "receipt_number": fdr.receipt_number if fdr else None,
            "bank_name": fdr.bank_name if fdr else None,
            "branch_name": fdr.branch_name if fdr else None,
            "principal_amount": fdr.principal_amount if fdr else None,
            "interest_rate": fdr.interest_rate if fdr else None,
            "maturity_date": fdr.maturity_date if fdr else None,
            "maturity_amount": fdr.maturity_amount if fdr else None,
            "verification_status": fdr.verification_status if fdr else None,
        } if fdr else None,
        "fields": field_list,
    }


# ------------------------------------------------------------------------------
# 8. PUT /api/documents/{document_id}/extraction/review - Review & Field Corrections
# ------------------------------------------------------------------------------
@router.put("/{document_id}/extraction/review", summary="Review Extracted Fields (Accept, Edit, Mark Uncertain)")
def review_extracted_fields(
    document_id: str,
    payload: BatchFieldReviewRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submits manual reviews or corrections on extracted fields.
    Preserves original_value while updating current_value.
    Syncs changes to linked FDRRecordModel and records an audit event.
    """
    doc = db.query(Document).filter(Document.document_id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    ext_res = doc.extraction_result
    if not ext_res:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No extraction result found for this document.")

    updated_count = 0
    fdr = doc.fdr_record

    for review in payload.fields:
        field = db.query(ExtractionField).filter(
            ExtractionField.extraction_result_id == ext_res.id,
            ExtractionField.field_key == review.field_key,
        ).first()

        if field:
            field.review_status = review.review_status
            field.last_reviewed_by = user.username
            field.reviewed_at = datetime.now(timezone.utc)

            if review.new_value is not None and review.new_value != field.original_value:
                field.current_value = review.new_value
                field.is_edited = True

                # Propagate edits to linked FDR record
                if fdr:
                    if review.field_key == "principal_amount":
                        try:
                            fdr.principal_amount = float(review.new_value.replace(",", "").replace("Rs.", "").strip())
                        except ValueError:
                            pass
                    elif review.field_key == "maturity_amount":
                        try:
                            fdr.maturity_amount = float(review.new_value.replace(",", "").replace("Rs.", "").strip())
                        except ValueError:
                            pass
                    elif review.field_key == "interest_rate":
                        try:
                            fdr.interest_rate = float(review.new_value.replace("%", "").strip())
                        except ValueError:
                            pass
                    elif review.field_key == "bank_name":
                        fdr.bank_name = review.new_value.strip()
                    elif review.field_key == "fdr_number":
                        fdr.receipt_number = review.new_value.strip()

            updated_count += 1

    db.commit()

    # Record in tamper-evident audit log
    audit_log.record(
        action="EXTRACTION_FIELDS_REVIEWED",
        actor_id=user.id,
        actor_username=user.username,
        resource_id=document_id,
        details={
            "reviewed_fields_count": updated_count,
            "reviewer_notes": payload.reviewer_notes,
        },
    )

    return {
        "success": True,
        "message": f"Successfully updated {updated_count} fields.",
        "updated_count": updated_count,
    }
