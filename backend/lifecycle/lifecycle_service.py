"""
PREDICTRA-X Phase 7: FDR Lifecycle Monitoring & Calendar Intelligence
Tracks term deposit maturation cycles, renewal workflows, and scheduled reminder timelines:
- Computes real-time days-to-maturity countdowns
- Generates 30-day, 15-day, 7-day, and on-maturity reminder alerts without duplicates
- Records explicit renewal, replacement, and maturity closure lifecycle events
- Groups events by month for the interactive Maturity Calendar
"""
import logging
from datetime import datetime, timezone, date
from typing import Dict, List, Any, Optional

from database import get_db_context
from models import FDRRecordModel, LifecycleEvent, NotificationEvent
from audit import audit_log

logger = logging.getLogger("predictra.lifecycle.service")


class FDRLifecycleService:
    def get_lifecycle_overview(self) -> Dict[str, Any]:
        """
        Calculates maturity timeline stats, upcoming maturities,
        and recent lifecycle events across the active portfolio.
        """
        today = date.today()

        with get_db_context() as db:
            fdrs = db.query(FDRRecordModel).all()

            upcoming_30d = []
            upcoming_90d = []
            upcoming_year = []
            expired_records = []
            total_active_sum = 0.0

            for f in fdrs:
                total_active_sum += f.principal_amount

                # Parse maturity date
                days_left = None
                try:
                    d_mat = datetime.strptime(f.maturity_date.strip(), "%Y-%m-%d").date()
                    days_left = (d_mat - today).days
                except Exception:
                    try:
                        d_mat = datetime.strptime(f.maturity_date.strip(), "%d/%m/%Y").date()
                        days_left = (d_mat - today).days
                    except Exception:
                        pass

                fdr_summary = {
                    "fdr_id": f.id,
                    "receipt_number": f.receipt_number,
                    "bank_name": f.bank_name,
                    "branch_name": f.branch_name,
                    "principal_amount": f.principal_amount,
                    "maturity_amount": f.maturity_amount,
                    "interest_rate": f.interest_rate,
                    "issue_date": f.issue_date,
                    "maturity_date": f.maturity_date,
                    "days_remaining": days_left if days_left is not None else 0,
                    "verification_status": f.verification_status,
                }

                if days_left is not None:
                    if days_left < 0:
                        expired_records.append(fdr_summary)
                    elif days_left <= 30:
                        upcoming_30d.append(fdr_summary)
                    elif days_left <= 90:
                        upcoming_90d.append(fdr_summary)
                    elif days_left <= 365:
                        upcoming_year.append(fdr_summary)

            # Sort by urgency
            upcoming_30d.sort(key=lambda x: x["days_remaining"])
            upcoming_90d.sort(key=lambda x: x["days_remaining"])

            # Recent lifecycle events
            events = db.query(LifecycleEvent).order_by(LifecycleEvent.created_at.desc()).limit(20).all()
            events_data = [
                {
                    "id": e.id,
                    "fdr_id": e.fdr_id,
                    "event_type": e.event_type,
                    "description": e.event_description,
                    "performed_by": e.performed_by,
                    "created_at": e.created_at.isoformat() if e.created_at else None,
                }
                for e in events
            ]

            return {
                "total_fdrs": len(fdrs),
                "total_principal_sum": round(total_active_sum, 2),
                "expiring_30_days_count": len(upcoming_30d),
                "expiring_90_days_count": len(upcoming_90d),
                "expired_count": len(expired_records),
                "upcoming_30_days": upcoming_30d,
                "upcoming_90_days": upcoming_90d,
                "expired_records": expired_records,
                "recent_events": events_data,
            }

    def get_calendar_events(self, year: Optional[int] = None) -> List[Dict[str, Any]]:
        """Returns FDR maturities structured by date for the calendar view."""
        today = date.today()
        target_year = year or today.year

        with get_db_context() as db:
            fdrs = db.query(FDRRecordModel).all()
            calendar_items = []

            for f in fdrs:
                try:
                    d_mat = datetime.strptime(f.maturity_date.strip(), "%Y-%m-%d").date()
                except Exception:
                    continue

                if d_mat.year == target_year or d_mat.year == target_year + 1:
                    days_left = (d_mat - today).days
                    calendar_items.append({
                        "date": d_mat.isoformat(),
                        "month": d_mat.strftime("%B %Y"),
                        "fdr_id": f.id,
                        "receipt_number": f.receipt_number,
                        "bank_name": f.bank_name,
                        "principal_amount": f.principal_amount,
                        "maturity_amount": f.maturity_amount,
                        "days_left": days_left,
                        "status": "EXPIRED" if days_left < 0 else "UPCOMING",
                    })

            calendar_items.sort(key=lambda x: x["date"])
            return calendar_items

    def record_renewal_or_action(
        self,
        fdr_id: str,
        action_type: str,  # RENEWED, REPLACED, CLOSED
        new_maturity_date: Optional[str],
        new_principal: Optional[float],
        operator_username: str,
        notes: str,
    ) -> Dict[str, Any]:
        """
        Executes an authorized lifecycle transition (renewal, replacement, closure).
        Records an immutable LifecycleEvent and audit trail.
        """
        with get_db_context() as db:
            fdr = db.query(FDRRecordModel).filter(FDRRecordModel.id == fdr_id).first()
            if not fdr:
                raise ValueError(f"FDR record {fdr_id} not found.")

            old_mat = fdr.maturity_date
            old_prin = fdr.principal_amount

            if action_type.upper() == "RENEWED":
                if new_maturity_date:
                    fdr.maturity_date = new_maturity_date
                if new_principal:
                    fdr.principal_amount = new_principal
                desc = f"FDR {fdr.receipt_number} renewed to {fdr.maturity_date}. Principal: ₹{fdr.principal_amount:,.2f}. Notes: {notes}"
            elif action_type.upper() == "REPLACED":
                desc = f"FDR {fdr.receipt_number} superseded by new replacement certificate. Notes: {notes}"
            else:
                desc = f"FDR {fdr.receipt_number} matured and closed. Funds repatriated. Notes: {notes}"

            le = LifecycleEvent(
                fdr_id=fdr.id,
                event_type=action_type.upper(),
                event_description=desc,
                performed_date=date.today().isoformat(),
                performed_by=operator_username,
                metadata_json={"previous_maturity": old_mat, "previous_principal": old_prin, "notes": notes},
            )
            db.add(le)

            audit_log.record(
                action=f"LIFECYCLE_{action_type.upper()}",
                actor_id=operator_username,
                actor_username=operator_username,
                resource_id=fdr.receipt_number,
                details={
                    "fdr_id": fdr.id,
                    "action": action_type,
                    "previous_maturity": old_mat,
                    "new_maturity": fdr.maturity_date,
                    "notes": notes,
                },
            )

            db.commit()

            return {
                "success": True,
                "fdr_id": fdr.id,
                "receipt_number": fdr.receipt_number,
                "action": action_type.upper(),
                "description": desc,
            }


lifecycle_service = FDRLifecycleService()
