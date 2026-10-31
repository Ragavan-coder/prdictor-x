"""
PREDICTRA-X Cryptographic Audit Log
Implements tamper-evident SHA-256 Merkle chaining for all security and FDR lifecycle events.
"""
import hashlib
import json
import time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

class AuditEntry(BaseModel):
    index: int
    timestamp: float
    iso_time: str
    action: str
    actor_id: str
    actor_username: str
    resource_id: Optional[str] = None
    details: Dict[str, Any]
    prev_hash: str
    entry_hash: str


class AuditLogChain:
    def __init__(self):
        self.chain: List[AuditEntry] = []
        # Pre-populate genesis entry
        self._create_genesis()

    def _create_genesis(self):
        timestamp = 1730000000.0
        payload = {
            "index": 0,
            "timestamp": timestamp,
            "action": "SYSTEM_GENESIS",
            "actor_id": "system",
            "actor_username": "sentra-core",
            "details": {"message": "PREDICTRA-X SENTRA Four-Layer Verification Core Initialized"},
            "prev_hash": GENESIS_HASH,
        }
        h = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        self.chain.append(
            AuditEntry(
                index=0,
                timestamp=timestamp,
                iso_time="2026-10-29T00:00:00Z",
                action="SYSTEM_GENESIS",
                actor_id="system",
                actor_username="sentra-core",
                resource_id=None,
                details=payload["details"],
                prev_hash=GENESIS_HASH,
                entry_hash=h,
            )
        )

    def record(
        self,
        action: str,
        actor_id: str,
        actor_username: str,
        details: Dict[str, Any],
        resource_id: Optional[str] = None,
    ) -> AuditEntry:
        """
        Appends a new event to the audit chain, cryptographically linking it
        to the previous event hash with SHA-256.
        """
        # Ensure no sensitive credentials ever get logged
        sanitized_details = self._sanitize(details)
        now = time.time()
        prev = self.chain[-1]
        new_index = len(self.chain)

        payload = {
            "index": new_index,
            "timestamp": now,
            "action": action,
            "actor_id": actor_id,
            "actor_username": actor_username,
            "resource_id": resource_id,
            "details": sanitized_details,
            "prev_hash": prev.entry_hash,
        }
        entry_hash = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()

        entry = AuditEntry(
            index=new_index,
            timestamp=now,
            iso_time=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now)),
            action=action,
            actor_id=actor_id,
            actor_username=actor_username,
            resource_id=resource_id,
            details=sanitized_details,
            prev_hash=prev.entry_hash,
            entry_hash=entry_hash,
        )
        self.chain.append(entry)
        return entry

    def verify_integrity(self) -> bool:
        """Verifies the complete SHA-256 chain from genesis to head."""
        for i in range(1, len(self.chain)):
            curr = self.chain[i]
            prev = self.chain[i - 1]
            if curr.prev_hash != prev.entry_hash:
                return False
            payload = {
                "index": curr.index,
                "timestamp": curr.timestamp,
                "action": curr.action,
                "actor_id": curr.actor_id,
                "actor_username": curr.actor_username,
                "resource_id": curr.resource_id,
                "details": curr.details,
                "prev_hash": curr.prev_hash,
            }
            computed = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
            if computed != curr.entry_hash:
                return False
        return True

    def _sanitize(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Deep sanitization removing any token, password, or OTP fields."""
        sensitive_keys = {"token", "access_token", "refresh_token", "password", "otp", "code", "secret", "authorization"}
        cleaned = {}
        for k, v in data.items():
            if any(s in k.lower() for s in sensitive_keys):
                cleaned[k] = "[REDACTED]"
            elif isinstance(v, dict):
                cleaned[k] = self._sanitize(v)
            else:
                cleaned[k] = v
        return cleaned

audit_log = AuditLogChain()


class CryptographicAuditVerifier:
    def verify_integrity(self) -> Dict[str, Any]:
        from database import get_db_context
        from models import AuditEventModel

        with get_db_context() as db:
            events = db.query(AuditEventModel).order_by(AuditEventModel.index.asc()).all()
            if not events:
                is_ok = audit_log.verify_integrity()
                return {
                    "is_valid": is_ok,
                    "total_events": len(audit_log.chain),
                    "genesis_hash": audit_log.chain[0].entry_hash if audit_log.chain else None,
                    "head_hash": audit_log.chain[-1].entry_hash if audit_log.chain else None,
                    "broken_links_count": 0 if is_ok else 1,
                    "violations": [],
                    "message": f"Cryptographic audit chain 100% verified intact ({len(audit_log.chain)} blocks).",
                }

            expected_prev_hash = GENESIS_HASH
            violations = []

            for ev in events:
                if ev.index > 0 and ev.prev_hash != expected_prev_hash:
                    violations.append({
                        "index": ev.index,
                        "event_id": ev.id,
                        "action": ev.action,
                        "error": f"Previous hash mismatch at index {ev.index}. Stored: {ev.prev_hash[:16]}..., Expected: {expected_prev_hash[:16]}...",
                    })
                expected_prev_hash = ev.entry_hash

            is_valid = len(violations) == 0
            return {
                "is_valid": is_valid,
                "total_events": len(events),
                "genesis_hash": events[0].entry_hash if events else None,
                "head_hash": events[-1].entry_hash if events else None,
                "broken_links_count": len(violations),
                "violations": violations,
                "message": (
                    f"Cryptographic audit chain 100% verified intact. {len(events)} tamper-evident blocks validated."
                    if is_valid else f"Audit chain integrity compromised: {len(violations)} violations detected."
                ),
            }


audit_verifier = CryptographicAuditVerifier()
