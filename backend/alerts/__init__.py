"""
PREDICTRA-X Alerts & Notifications Package
"""
from alerts.email_service import email_service
from alerts.inapp_alerts import inapp_notifications

__all__ = ["email_service", "inapp_notifications"]
