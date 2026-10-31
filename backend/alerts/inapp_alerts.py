"""
PREDICTRA-X Phase 6: In-App Notification Center
Manages real-time in-app alerts, read states, and severity filtering.
"""
import logging
from typing import Dict, List, Any, Optional

from database import get_db_context
from models import NotificationEvent, FDRRecordModel

logger = logging.getLogger("predictra.alerts.inapp")


class InAppNotificationManager:
    def list_notifications(
        self,
        unread_only: bool = False,
        min_severity: Optional[str] = None,
        limit: int = 50,
    ) -> Dict[str, Any]:
        """Returns list of notifications with unread counts."""
        with get_db_context() as db:
            query = db.query(NotificationEvent)
            if unread_only:
                query = query.filter(NotificationEvent.is_read == False)
            if min_severity:
                if min_severity == "CRITICAL":
                    query = query.filter(NotificationEvent.severity == "CRITICAL")
                elif min_severity == "HIGH":
                    query = query.filter(NotificationEvent.severity.in_(["HIGH", "CRITICAL"]))

            total_unread = db.query(NotificationEvent).filter(NotificationEvent.is_read == False).count()
            items = query.order_by(NotificationEvent.created_at.desc()).limit(limit).all()

            results = []
            for it in items:
                fdr = db.query(FDRRecordModel).filter(FDRRecordModel.id == it.fdr_id).first() if it.fdr_id else None
                results.append({
                    "id": it.id,
                    "title": it.title,
                    "message": it.message,
                    "severity": it.severity,
                    "category": it.category,
                    "is_read": it.is_read,
                    "action_link": it.action_link,
                    "fdr_ref": fdr.receipt_number if fdr else None,
                    "bank_name": fdr.bank_name if fdr else None,
                    "created_at": it.created_at.isoformat() if it.created_at else None,
                })

            return {
                "total_unread": total_unread,
                "count": len(results),
                "notifications": results,
            }

    def mark_as_read(self, notification_id: str) -> bool:
        """Marks a single notification as read."""
        with get_db_context() as db:
            notif = db.query(NotificationEvent).filter(NotificationEvent.id == notification_id).first()
            if notif:
                notif.is_read = True
                db.commit()
                return True
        return False

    def mark_all_as_read(self) -> int:
        """Marks all notifications as read."""
        with get_db_context() as db:
            count = db.query(NotificationEvent).filter(NotificationEvent.is_read == False).update({"is_read": True})
            db.commit()
            return count


inapp_notifications = InAppNotificationManager()
