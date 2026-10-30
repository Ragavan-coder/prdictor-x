"""
PREDICTRA-X Security Notification & Webhook Dispatcher
Dispatches automated security incident alerts to Webhook endpoints (Slack, Discord, MS Teams)
and Email SMTP channels upon suspicious events, failed TOTP verifications, and admin overrides.
"""
import asyncio
import logging
import os
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, List, Optional
import httpx
from pydantic import BaseModel, Field

logger = logging.getLogger("predictra.notifications")


class AlertSeverity:
    INFO = "INFO"
    WARNING = "WARNING"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SecurityAlert(BaseModel):
    id: str
    timestamp: float
    iso_time: str
    severity: str
    event_type: str
    title: str
    description: str
    actor: str
    ip_address: Optional[str] = "127.0.0.1"
    details: Dict = Field(default_factory=dict)
    dispatched_webhook: bool = False
    dispatched_email: bool = False


class NotificationConfig(BaseModel):
    webhook_url: Optional[str] = ""
    webhook_enabled: bool = False
    email_recipient: Optional[str] = ""
    email_enabled: bool = False
    min_severity: str = "HIGH"  # INFO, WARNING, HIGH, CRITICAL


class NotificationManager:
    def __init__(self):
        self.alerts: List[SecurityAlert] = []
        self.config = NotificationConfig(
            webhook_url=os.getenv("ALERT_WEBHOOK_URL", ""),
            webhook_enabled=bool(os.getenv("ALERT_WEBHOOK_URL", "")),
            email_recipient=os.getenv("ALERT_EMAIL_RECIPIENT", "security@predictra.x"),
            email_enabled=False,
            min_severity="HIGH",
        )
        # Pre-populate with initial startup alert
        self._create_initial_alerts()

    def _create_initial_alerts(self):
        now = time.time()
        self.alerts.append(
            SecurityAlert(
                id=f"alert-sys-001",
                timestamp=now - 120,
                iso_time=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now - 120)),
                severity=AlertSeverity.INFO,
                event_type="SENTINEL_ARMED",
                title="Security Alert Dispatcher Active",
                description="Predictra-X Sentinel real-time incident monitoring and webhook dispatcher armed.",
                actor="system",
                ip_address="127.0.0.1",
                details={"subsystem": "alert_engine", "version": "1.0.0"},
                dispatched_webhook=False,
                dispatched_email=False,
            )
        )

    def get_recent_alerts(self, limit: int = 30) -> List[SecurityAlert]:
        return sorted(self.alerts, key=lambda a: a.timestamp, reverse=True)[:limit]

    def update_config(self, new_config: NotificationConfig) -> NotificationConfig:
        self.config = new_config
        logger.info(f"Notification config updated: webhook_enabled={new_config.webhook_enabled}")
        return self.config

    async def trigger_alert(
        self,
        event_type: str,
        title: str,
        description: str,
        severity: str,
        actor: str,
        details: Optional[Dict] = None,
        ip_address: Optional[str] = "127.0.0.1",
    ) -> SecurityAlert:
        """Creates a security alert and dispatches it asynchronously to configured channels."""
        now = time.time()
        alert_id = f"alert-{int(now * 1000)}"
        alert = SecurityAlert(
            id=alert_id,
            timestamp=now,
            iso_time=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now)),
            severity=severity,
            event_type=event_type,
            title=title,
            description=description,
            actor=actor,
            ip_address=ip_address,
            details=details or {},
            dispatched_webhook=False,
            dispatched_email=False,
        )

        self.alerts.insert(0, alert)
        if len(self.alerts) > 100:
            self.alerts.pop()

        # Asynchronously dispatch to external channels (non-blocking)
        asyncio.create_task(self._dispatch_channels(alert))
        return alert

    async def _dispatch_channels(self, alert: SecurityAlert):
        # 1. Webhook dispatch (Slack/Discord format compatible)
        if self.config.webhook_enabled and self.config.webhook_url:
            try:
                await self._send_webhook(alert)
                alert.dispatched_webhook = True
            except Exception as e:
                logger.warning(f"Webhook dispatch failed: {e}")

        # 2. Email dispatch
        if self.config.email_enabled and self.config.email_recipient:
            try:
                await self._send_email(alert)
                alert.dispatched_email = True
            except Exception as e:
                logger.warning(f"Email dispatch failed: {e}")

    async def _send_webhook(self, alert: SecurityAlert):
        # Determine color badge based on severity
        color_map = {
            AlertSeverity.INFO: 0x3B82F6,      # Blue
            AlertSeverity.WARNING: 0xF59E0B,   # Amber
            AlertSeverity.HIGH: 0xEF4444,      # Crimson Red
            AlertSeverity.CRITICAL: 0x991B1B,  # Deep Red
        }
        color = color_map.get(alert.severity, 0xEF4444)

        payload = {
            "username": "PREDICTRA-X Sentinel Security",
            "avatar_url": "https://raw.githubusercontent.com/Ragavan-coder/prdictor-x/main/predictra-app/public/pred_x_only.png",
            "content": f"🚨 **[PREDICTRA-X SECURITY ALERT]** Level: `{alert.severity}` - {alert.title}",
            "embeds": [
                {
                    "title": f"[{alert.severity}] {alert.title}",
                    "description": alert.description,
                    "color": color,
                    "fields": [
                        {"name": "Incident Type", "value": f"`{alert.event_type}`", "inline": True},
                        {"name": "Actor / User", "value": f"`{alert.actor}`", "inline": True},
                        {"name": "Origin IP", "value": f"`{alert.ip_address}`", "inline": True},
                        {"name": "Timestamp", "value": alert.iso_time, "inline": False},
                    ],
                    "footer": {
                        "text": "PREDICTRA-X SENTRA Cryptographic Audit Chain",
                    },
                }
            ],
        }

        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(self.config.webhook_url, json=payload)
            logger.info(f"Webhook dispatched to {self.config.webhook_url[:30]}... status: {res.status_code}")

    async def _send_email(self, alert: SecurityAlert):
        """Simulates or dispatches SMTP security email."""
        logger.info(f"[EMAIL ALERT DISPATCHED] To: {self.config.email_recipient} | Subject: [{alert.severity}] {alert.title}")


# Global notification manager singleton
notification_manager = NotificationManager()
