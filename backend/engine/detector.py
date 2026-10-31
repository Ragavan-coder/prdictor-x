"""
PREDICTRA-X Document Type & Signature Detector
Identifies document formats through byte-level magic signature analysis.
"""
from typing import Tuple


def detect_document_type(content: bytes) -> Tuple[str, str]:
    """
    Detects format from byte signature.
    Returns: (category, mime_type) where category is 'pdf' or 'image'
    Raises: ValueError on unknown/unsupported signature.
    """
    if len(content) < 4:
        raise ValueError("File content is too small to determine format.")

    if content.startswith(b"%PDF"):
        return "pdf", "application/pdf"
    elif content.startswith(b"\xff\xd8\xff"):
        return "image", "image/jpeg"
    elif content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image", "image/png"
    else:
        raise ValueError("Unsupported or unknown document format. Expected PDF, JPEG, or PNG.")
