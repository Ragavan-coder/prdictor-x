"""
PREDICTRA-X Backend Configuration
Loads Keycloak, CORS, and security parameters from environment variables with sensible defaults.
"""
import os
from typing import List

class Settings:
    KEYCLOAK_URL: str = os.getenv("KEYCLOAK_URL", "http://localhost:8080").rstrip("/")
    KEYCLOAK_REALM: str = os.getenv("KEYCLOAK_REALM", "predictra-x")
    KEYCLOAK_CLIENT_ID: str = os.getenv("KEYCLOAK_CLIENT_ID", "predictra-x-frontend")
    KEYCLOAK_ADMIN: str = os.getenv("KEYCLOAK_ADMIN", "admin")
    KEYCLOAK_ADMIN_PASSWORD: str = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "SentraAdmin#2026!")
    
    # CORS: Explicitly allowed origins
    CORS_ORIGINS_RAW: str = os.getenv(
        "BACKEND_CORS_ORIGINS", 
        "http://localhost:5173,http://127.0.0.1:5173"
    )

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS_RAW.split(",") if origin.strip()]

    @property
    def issuer(self) -> str:
        return f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}"

    @property
    def jwks_url(self) -> str:
        return f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}/protocol/openid-connect/certs"

    @property
    def openid_config_url(self) -> str:
        return f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}/.well-known/openid-configuration"

settings = Settings()
