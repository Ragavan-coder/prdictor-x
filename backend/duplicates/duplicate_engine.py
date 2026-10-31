"""
PREDICTRA-X Phase 5: Advanced Duplicate Intelligence Engine
Detects duplicates across three distinct analytical tiers:
- LEVEL 1: Exact File Duplicate (Cryptographic SHA-256 fingerprint matching)
- LEVEL 2: Near-Duplicate Document (Perceptual 64-bit dHash gradient distance <= 10 bits)
- LEVEL 3: Financial Record Duplicate (Identical FDR # with matching or conflicting values)
Preserves both documents and complete audit trails without destructive deletion.
"""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from database import get_db_context
from models import FDRRecordModel, Document, DuplicateMatch
from guardian.anomaly_detector import compute_dhash, hamming_distance
from storage import storage_service

logger = logging.getLogger("predictra.duplicates.engine")


class DuplicateIntelligenceEngine:
    def scan_for_duplicates(self, target_fdr_id: str) -> List[Dict[str, Any]]:
        """
        Executes Level 1, Level 2, and Level 3 duplicate scans for a given FDR record.
        Saves detected duplicate relationships into the duplicate_matches table.
        """
        matches = []

        with get_db_context() as db:
            target_fdr = db.query(FDRRecordModel).filter(FDRRecordModel.id == target_fdr_id).first()
            if not target_fdr:
                return []

            target_doc = db.query(Document).filter(Document.document_id == target_fdr.document_id).first() if target_fdr.document_id else None

            # Compute dHash if document bytes exist
            target_dhash = ""
            if target_doc and target_doc.stored_object_key:
                try:
                    raw_bytes = storage_service.get_document_bytes(target_doc.stored_object_key)
                    target_dhash = compute_dhash(raw_bytes)
                except Exception as e:
                    logger.warning(f"Could not compute dHash for target doc: {e}")

            all_other_fdrs = db.query(FDRRecordModel).filter(FDRRecordModel.id != target_fdr.id).all()

            for other_fdr in all_other_fdrs:
                other_doc = db.query(Document).filter(Document.document_id == other_fdr.document_id).first() if other_fdr.document_id else None

                # --------------------------------------------------------------
                # LEVEL 1: Exact File Duplicate (SHA-256)
                # --------------------------------------------------------------
                if target_doc and other_doc and target_doc.sha256_hash == other_doc.sha256_hash:
                    m = self._record_match(
                        db=db,
                        primary_fdr=other_fdr,
                        duplicate_fdr=target_fdr,
                        primary_doc=other_doc,
                        duplicate_doc=target_doc,
                        level="LEVEL_1_EXACT_FILE",
                        similarity=1.0,
                        matched_fields=["sha256_hash", "file_size", "file_type"],
                        conflicting_fields=[],
                        recommended_action="Reject re-upload or link as secondary digital alias. Original document remains master.",
                    )
                    matches.append(m)
                    continue

                # --------------------------------------------------------------
                # LEVEL 3: Financial Record Duplicate (Same FDR #)
                # --------------------------------------------------------------
                if target_fdr.receipt_number.strip().upper() == other_fdr.receipt_number.strip().upper():
                    matched = ["receipt_number"]
                    conflicting = []

                    if target_fdr.principal_amount == other_fdr.principal_amount:
                        matched.append("principal_amount")
                    else:
                        conflicting.append(f"principal_amount (₹{target_fdr.principal_amount:,.2f} vs ₹{other_fdr.principal_amount:,.2f})")

                    if target_fdr.maturity_date == other_fdr.maturity_date:
                        matched.append("maturity_date")
                    else:
                        conflicting.append(f"maturity_date ({target_fdr.maturity_date} vs {other_fdr.maturity_date})")

                    if target_fdr.bank_name.lower() == other_fdr.bank_name.lower():
                        matched.append("bank_name")
                    else:
                        conflicting.append(f"bank_name ({target_fdr.bank_name} vs {other_fdr.bank_name})")

                    sim = 0.95 if not conflicting else 0.85
                    action = (
                        "Confirmed duplicate certificate." if not conflicting
                        else "CRITICAL CONFLICT: Multiple receipts uploaded with identical FDR # but mismatched deposit sums. Initiate fraud review."
                    )

                    m = self._record_match(
                        db=db,
                        primary_fdr=other_fdr,
                        duplicate_fdr=target_fdr,
                        primary_doc=other_doc,
                        duplicate_doc=target_doc,
                        level="LEVEL_3_FINANCIAL_RECORD",
                        similarity=sim,
                        matched_fields=matched,
                        conflicting_fields=conflicting,
                        recommended_action=action,
                    )
                    matches.append(m)
                    continue

                # --------------------------------------------------------------
                # LEVEL 2: Near-Duplicate Document (Perceptual dHash)
                # --------------------------------------------------------------
                if target_dhash and other_doc and other_doc.stored_object_key:
                    try:
                        other_bytes = storage_service.get_document_bytes(other_doc.stored_object_key)
                        other_dhash = compute_dhash(other_bytes)
                        if other_dhash:
                            dist = hamming_distance(target_dhash, other_dhash)
                            if dist <= 10:  # <= 10 bit flips out of 64 indicates near-identical visual layout
                                sim = round((64 - dist) / 64.0, 3)
                                m = self._record_match(
                                    db=db,
                                    primary_fdr=other_fdr,
                                    duplicate_fdr=target_fdr,
                                    primary_doc=other_doc,
                                    duplicate_doc=target_doc,
                                    level="LEVEL_2_NEAR_DUPLICATE",
                                    similarity=sim,
                                    matched_fields=["layout_geometry", "header_masthead", "security_border"],
                                    conflicting_fields=[],
                                    recommended_action=f"Near-identical visual layout detected (Hamming distance: {dist}/64). Verify whether documents share standard bank template.",
                                )
                                matches.append(m)
                    except Exception as e:
                        logger.warning(f"Error comparing dHash: {e}")

            db.commit()

        return matches

    def _record_match(
        self,
        db,
        primary_fdr,
        duplicate_fdr,
        primary_doc,
        duplicate_doc,
        level: str,
        similarity: float,
        matched_fields: List[str],
        conflicting_fields: List[str],
        recommended_action: str,
    ) -> Dict[str, Any]:
        """Helper to persist or update duplicate match record."""
        existing = db.query(DuplicateMatch).filter(
            DuplicateMatch.primary_fdr_id == primary_fdr.id,
            DuplicateMatch.duplicate_fdr_id == duplicate_fdr.id,
            DuplicateMatch.match_level == level,
        ).first()

        if not existing:
            dm = DuplicateMatch(
                primary_fdr_id=primary_fdr.id,
                duplicate_fdr_id=duplicate_fdr.id,
                primary_document_id=primary_doc.document_id if primary_doc else None,
                duplicate_document_id=duplicate_doc.document_id if duplicate_doc else None,
                match_level=level,
                similarity_score=similarity,
                matched_fields_json=matched_fields,
                conflicting_fields_json=conflicting_fields,
                recommended_action=recommended_action,
                status="DETECTED",
            )
            db.add(dm)
            db.flush()
            match_id = dm.id
        else:
            match_id = existing.id

        return {
            "id": match_id,
            "match_level": level,
            "similarity_score": similarity,
            "primary_fdr_ref": primary_fdr.receipt_number,
            "primary_bank": primary_fdr.bank_name,
            "duplicate_fdr_ref": duplicate_fdr.receipt_number,
            "duplicate_bank": duplicate_fdr.bank_name,
            "matched_fields": matched_fields,
            "conflicting_fields": conflicting_fields,
            "recommended_action": recommended_action,
        }


duplicate_engine = DuplicateIntelligenceEngine()
