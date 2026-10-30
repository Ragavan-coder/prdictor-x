"""
PREDICTRA-X Security Alert & Notification Management Routes
Provides endpoints for monitoring incident alerts, configuring Slack/Discord webhooks,
and dispatching manual or automated security test notifications.
"""
from typing import List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from notifications import (
    notification_manager,
    SecurityAlert,
    NotificationConfig,
    AlertSeverity,
)

router = APIRouter(prefix="/api/alerts", tags=["Security Alerts & Notifications"])


class TestAlertRequest(BaseModel):
    title: str = "Simulated Security Incident"
    severity: str = "HIGH"
    description: str = "Test trigger of automated security webhook and incident notification."


@router.get(
    "/recent",
    response_model=List[SecurityAlert],
    summary="Get recent security incidents and alert dispatches",
)
async def get_recent_alerts(limit: int = 30):
    return notification_manager.get_recent_alerts(limit=limit)


@router.get(
    "/config",
    response_model=NotificationConfig,
    summary="Get current webhook and email notification settings",
)
async def get_alert_config():
    return notification_manager.config


@router.post(
    "/config",
    response_model=NotificationConfig,
    summary="Update webhook URL and email recipient settings",
)
async def update_alert_config(config: NotificationConfig):
    return notification_manager.update_config(config)


@router.post(
    "/test",
    response_model=SecurityAlert,
    summary="Trigger a test security alert to verified webhook channels",
)
async def trigger_test_alert(req: TestAlertRequest):
    valid_severities = [AlertSeverity.INFO, AlertSeverity.WARNING, AlertSeverity.HIGH, AlertSeverity.CRITICAL]
    severity = req.severity.upper() if req.severity.upper() in valid_severities else AlertSeverity.HIGH

    alert = await notification_manager.trigger_alert(
        event_type="TEST_INCIDENT_DISPATCH",
        title=req.title,
        description=req.description,
        severity=severity,
        actor="operator@predictra.x",
        details={"channel_test": True, "source": "sentra_console"},
        ip_address="127.0.0.1",
    )
    return alert
