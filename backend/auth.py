"""
PREDICTRA-X Security & Keycloak JWT Validation
Performs cryptographic signature validation using Keycloak's published JWKS keys,
enforces expiry, issuer, and role-based access control (RBAC).
"""
import time
import logging
from typing import Dict, Any, List, Optional
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel, Field

from config import settings

logger = logging.getLogger("predictra.auth")

# HTTP Bearer scheme
security_bearer = HTTPBearer(auto_error=False)

class AuthenticatedUser(BaseModel):
    id: str = Field(..., description="Keycloak subject UUID")
    username: str
    email: Optional[str] = None
    name: Optional[str] = None
    roles: List[str] = Field(default_factory=list)
    client_roles: List[str] = Field(default_factory=list)

    def has_role(self, role: str) -> bool:
        return role in self.roles or role in self.client_roles

    @property
    def is_admin(self) -> bool:
        return self.has_role("sentra-admin")

    @property
    def is_operator(self) -> bool:
        return self.has_role("sentra-operator") or self.is_admin


class JWKSCache:
    """In-memory cache for Keycloak's public JSON Web Key Set with TTL."""
    def __init__(self, ttl_seconds: int = 3600):
        self.ttl = ttl_seconds
        self.last_fetch: float = 0
        self.keys: Dict[str, Dict[str, Any]] = {}

    async def get_key(self, kid: str) -> Optional[Dict[str, Any]]:
        now = time.time()
        # Refresh if cache expired or requested kid is missing
        if now - self.last_fetch > self.ttl or kid not in self.keys:
            await self.refresh()
        return self.keys.get(kid)

    async def refresh(self) -> None:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(settings.jwks_url)
                if res.status_code == 200:
                    data = res.json()
                    new_keys = {}
                    for k in data.get("keys", []):
                        if "kid" in k:
                            new_keys[k["kid"]] = k
                    self.keys = new_keys
                    self.last_fetch = time.time()
                    logger.info("Keycloak JWKS keys refreshed successfully (%d keys cached)", len(self.keys))
                else:
                    logger.warning("Failed to fetch JWKS from Keycloak (status %d)", res.status_code)
        except Exception as e:
            logger.error("Exception connecting to Keycloak JWKS at %s: %s", settings.jwks_url, str(e))

jwks_cache = JWKSCache(ttl_seconds=3600)


async def validate_jwt(token: str) -> Dict[str, Any]:
    """
    Validates a JWT access token:
    1. Extracts header to find 'kid' and 'alg' (must be RS256)
    2. Retrieves public key from Keycloak JWKS
    3. Verifies signature, issuer, and expiration
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed access token header",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        )

    kid = unverified_header.get("kid")
    alg = unverified_header.get("alg")

    if alg != "RS256":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unsupported token signature algorithm",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        )

    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token header missing key identifier (kid)",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        )

    key_dict = await jwks_cache.get_key(kid)
    if not key_dict:
        # Retry refresh once in case keys were rotated
        await jwks_cache.refresh()
        key_dict = await jwks_cache.get_key(kid)
        if not key_dict:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Signing key not recognized by identity provider",
                headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
            )

    try:
        payload = jwt.decode(
            token,
            key_dict,
            algorithms=["RS256"],
            issuer=settings.issuer,
            options={
                "verify_aud": False,  # Keycloak access tokens often put client_id in azp
                "verify_exp": True,
                "verify_iss": True,
            },
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token has expired. Please re-authenticate.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"The access token expired\""},
        )
    except JWTError as e:
        logger.warning("JWT verification failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid security token signature or claims",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        )

    # Optional azp (authorized party) check
    azp = payload.get("azp")
    if azp and azp != settings.KEYCLOAK_CLIENT_ID:
        logger.warning("Token azp '%s' does not match expected client '%s'", azp, settings.KEYCLOAK_CLIENT_ID)

    return payload


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)
) -> AuthenticatedUser:
    """Dependency extracting and validating the authenticated user from the Bearer token."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = await validate_jwt(credentials.credentials)

    # Extract realm roles
    realm_access = payload.get("realm_access", {})
    realm_roles = realm_access.get("roles", []) if isinstance(realm_access, dict) else []

    # Extract client roles for predictra-x-frontend
    resource_access = payload.get("resource_access", {})
    client_access = resource_access.get(settings.KEYCLOAK_CLIENT_ID, {}) if isinstance(resource_access, dict) else {}
    client_roles = client_access.get("roles", []) if isinstance(client_access, dict) else []

    user = AuthenticatedUser(
        id=payload.get("sub", ""),
        username=payload.get("preferred_username") or payload.get("email") or payload.get("sub", ""),
        email=payload.get("email"),
        name=payload.get("name"),
        roles=realm_roles,
        client_roles=client_roles,
    )
    return user


def require_role(required_role: str):
    """Enforces role-based access control (RBAC). Rejects unauthorized calls with HTTP 403."""
    async def role_checker(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if not user.has_role(required_role) and not user.is_admin:
            logger.warning(
                "Access denied for user '%s': missing required role '%s' (User roles: %s)",
                user.username, required_role, user.roles
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Insufficient privileges. Required role: '{required_role}'.",
            )
        return user
    return role_checker
