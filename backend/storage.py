"""
PREDICTRA-X Secure Document Storage Service
Enterprise hybrid storage integrating MinIO S3 object storage with automated
local filesystem fallback for air-gapped or development deployments.
Includes SHA-256 cryptographic hashing and strict magic-byte validation.
"""
import os
import io
import re
import uuid
import hashlib
import logging
from typing import Optional, Tuple, BinaryIO

logger = logging.getLogger("predictra.storage")

# Configuration from environment
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "fdr-documents")

LOCAL_STORAGE_DIR = os.getenv(
    "LOCAL_STORAGE_DIR",
    os.path.join(os.path.dirname(__file__), "..", "storage", "documents")
)

MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", 25 * 1024 * 1024))  # 25MB default

# Allowed MIME types and extensions
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
}

# Known file signatures (magic bytes)
MAGIC_SIGNATURES = {
    "pdf": b"%PDF",
    "jpeg": b"\xff\xd8\xff",
    "png": b"\x89PNG\r\n\x1a\n",
}


def sanitize_filename(filename: str) -> str:
    """Sanitizes user filename to prevent path traversal and shell injection."""
    base = os.path.basename(filename)
    # Strip any characters except alphanumeric, dashes, dots, underscores
    sanitized = re.sub(r"[^a-zA-Z0-9._-]", "_", base)
    if not sanitized or sanitized.startswith("."):
        sanitized = f"fdr_{uuid.uuid4().hex[:8]}.pdf"
    return sanitized


class StorageValidationException(Exception):
    """Raised when file fails security validation."""
    pass


class StorageService:
    def __init__(self):
        self.minio_client = None
        self.using_minio = False
        self._init_storage()

    def _init_storage(self):
        """Initializes MinIO client if available, else prepares local directory."""
        os.makedirs(LOCAL_STORAGE_DIR, exist_ok=True)

        # Quick 0.5s socket check so we never hang if MinIO server is down
        endpoint_parts = MINIO_ENDPOINT.split(":")
        host = endpoint_parts[0]
        port = int(endpoint_parts[1]) if len(endpoint_parts) > 1 else 9000

        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.5)
        port_open = False
        try:
            port_open = sock.connect_ex((host, port)) == 0
        except Exception:
            port_open = False
        finally:
            sock.close()

        if not port_open:
            self.using_minio = False
            self.minio_client = None
            logger.info(f"MinIO port {port} closed. Using secure local filesystem storage at: {LOCAL_STORAGE_DIR}")
            return

        try:
            from minio import Minio
            client = Minio(
                MINIO_ENDPOINT,
                access_key=MINIO_ACCESS_KEY,
                secret_key=MINIO_SECRET_KEY,
                secure=MINIO_SECURE,
            )
            if client.bucket_exists(MINIO_BUCKET):
                logger.info(f"MinIO bucket '{MINIO_BUCKET}' verified.")
            else:
                client.make_bucket(MINIO_BUCKET)
                logger.info(f"Created MinIO bucket '{MINIO_BUCKET}'.")
            
            self.minio_client = client
            self.using_minio = True
            logger.info(f"StorageService initialized with MinIO backend at {MINIO_ENDPOINT}")
        except Exception as e:
            self.using_minio = False
            self.minio_client = None
            logger.info(f"MinIO unavailable ({e}). Using secure local filesystem storage at: {LOCAL_STORAGE_DIR}")

    def validate_file(self, filename: str, content: bytes, declared_mime: Optional[str] = None) -> Tuple[str, str]:
        """
        Validates file extension, length, and magic signatures.
        Returns: (detected_type, extension)
        Raises: StorageValidationException
        """
        # 1. Check size
        if len(content) == 0:
            raise StorageValidationException("File is empty (0 bytes).")
        if len(content) > MAX_UPLOAD_SIZE:
            raise StorageValidationException(
                f"File exceeds maximum allowed size of {MAX_UPLOAD_SIZE / (1024*1024):.1f}MB."
            )

        # 2. Check extension
        _, ext = os.path.splitext(filename.lower())
        if ext not in ALLOWED_EXTENSIONS:
            raise StorageValidationException(
                f"Unsupported file extension '{ext}'. Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}."
            )

        # 3. Check MIME type if provided
        if declared_mime and declared_mime.lower() not in ALLOWED_MIME_TYPES:
            # Allow fallback if signature matches
            pass

        # 4. Strict Magic Signature validation
        detected_type = None
        if content.startswith(MAGIC_SIGNATURES["pdf"]):
            detected_type = "application/pdf"
        elif content.startswith(MAGIC_SIGNATURES["jpeg"]):
            detected_type = "image/jpeg"
        elif content.startswith(MAGIC_SIGNATURES["png"]):
            detected_type = "image/png"
        else:
            raise StorageValidationException(
                "Invalid or corrupted file content. File header does not match a valid PDF, JPEG, or PNG signature."
            )

        # Verify extension aligns with magic type
        if detected_type == "application/pdf" and ext != ".pdf":
            raise StorageValidationException(f"File content is PDF but extension is '{ext}'. Extension mismatch rejected.")
        if detected_type.startswith("image/") and ext not in {".jpg", ".jpeg", ".png"}:
            raise StorageValidationException(f"File content is image but extension is '{ext}'. Extension mismatch rejected.")

        return detected_type, ext

    def store_document(
        self,
        filename: str,
        content: bytes,
        declared_mime: Optional[str] = None
    ) -> Tuple[str, str, int, str]:
        """
        Validates, hashes, and stores the original document without alteration.
        Returns: (object_key, sha256_hash, file_size, detected_type)
        """
        detected_type, ext = self.validate_file(filename, content, declared_mime)
        
        # Calculate SHA-256 cryptographic digest
        sha256 = hashlib.sha256(content).hexdigest()
        file_size = len(content)

        # Construct safe, unique object key: fdr-docs/{sha256[:16]}_{uuid}/{safe_name}
        safe_name = sanitize_filename(filename)
        object_key = f"fdr-docs/{uuid.uuid4().hex[:12]}_{safe_name}"

        # Write to MinIO if available
        if self.using_minio and self.minio_client:
            try:
                stream = io.BytesIO(content)
                self.minio_client.put_object(
                    MINIO_BUCKET,
                    object_key,
                    stream,
                    length=file_size,
                    content_type=detected_type,
                )
                logger.info(f"Stored {safe_name} in MinIO [{object_key}]")
                return object_key, sha256, file_size, detected_type
            except Exception as e:
                logger.warning(f"MinIO put failed ({e}). Falling back to local storage.")

        # Fallback: store on local filesystem
        local_path = os.path.join(LOCAL_STORAGE_DIR, object_key)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(content)
        
        logger.info(f"Stored {safe_name} on local storage [{local_path}]")
        return object_key, sha256, file_size, detected_type

    def get_document_bytes(self, object_key: str) -> bytes:
        """Retrieves raw unmodified bytes from MinIO or local storage."""
        if self.using_minio and self.minio_client:
            try:
                res = self.minio_client.get_object(MINIO_BUCKET, object_key)
                data = res.read()
                res.close()
                res.release_conn()
                return data
            except Exception as e:
                logger.warning(f"MinIO get_object failed ({e}). Checking local storage...")

        local_path = os.path.join(LOCAL_STORAGE_DIR, object_key)
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                return f.read()
        
        raise FileNotFoundError(f"Document object '{object_key}' not found in storage.")

    def get_document_stream(self, object_key: str) -> io.BytesIO:
        """Returns a binary stream of document contents."""
        content = self.get_document_bytes(object_key)
        return io.BytesIO(content)


# Global storage service instance
storage_service = StorageService()
