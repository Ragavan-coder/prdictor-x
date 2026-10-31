"""
PREDICTRA-X Notification & Email Alert API Routes
"""
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from auth import AuthenticatedUser, get_current_user
from alerts.inapp_alerts import inapp_notifications
from alerts.email_service import email_service

logger = logging.getLogger("predictra.routes.notifications")

router = APIRouter(tags=["Alert & Notification System"])


class TestEmailRequest(BaseModel):
    recipient: Optional[str] = None
    fdr_ref: Optional[str] = "FDR-TEST-881920"
    severity: Optional[str] = "CRITICAL"


@router.get("/api/notifications", summary="Get notifications with unread counts")
def get_notifications(
    unread_only: bool = False,
    min_severity: Optional[str] = None,
    limit: int = 50,
    user: AuthenticatedUser = Depends(get_current_user),
):
    return inapp_notifications.list_notifications(
        unread_only=unread_only,
        min_severity=min_severity,
        limit=limit,
    )


@router.patch("/api/notifications/{notification_id}/read", summary="Mark single notification as read")
def mark_read(
    notification_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    ok = inapp_notifications.mark_as_read(notification_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    return {"success": True, "notification_id": notification_id}


@router.post("/api/notifications/mark-all-read", summary="Mark all notifications as read")
def mark_all_read(
    user: AuthenticatedUser = Depends(get_current_user),
):
    count = inapp_notifications.mark_all_as_read()
    return {"success": True, "marked_count": count}


@router.post("/api/alerts/test-email", summary="Trigger test SMTP security alert email")
def send_test_email(
    req: TestEmailRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    res = email_service.send_incident_alert(
        fdr_ref=req.fdr_ref or "FDR-TEST-881920",
        bank_name="State Bank of India (Forensic Test)",
        principal_amount=2500000.0,
        anomaly_type="TEST_CRITICAL_INCIDENT",
        severity=req.severity or "CRITICAL",
        evidence_summary="Manual test dispatch triggered by authenticated security operator.",
        recommended_action="Verify SMTP queue reception in corporate compliance inbox.",
        recipient_override=req.recipient,
    )
    return res
