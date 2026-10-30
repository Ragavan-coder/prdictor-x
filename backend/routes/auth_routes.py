"""
PREDICTRA-X Authentication & Registration Routes
Interfaces with Keycloak Admin REST API to create users,
assign default roles, and mandate TOTP multi-factor enrollment.
"""
import logging
from typing import Optional
import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from config import settings
from audit import audit_log

logger = logging.getLogger("predictra.auth_routes")
router = APIRouter(prefix="/api/auth", tags=["Authentication & Registration"])


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=150)
    password: str = Field(..., min_length=8)


class RegisterResponse(BaseModel):
    status: str
    message: str
    userId: Optional[str] = None
    email: str


async def get_keycloak_admin_token() -> str:
    """Authenticates to Keycloak master realm admin-cli to acquire an access token."""
    token_url = f"{settings.KEYCLOAK_URL}/realms/master/protocol/openid-connect/token"
    payload = {
        "client_id": "admin-cli",
        "username": settings.KEYCLOAK_ADMIN,
        "password": settings.KEYCLOAK_ADMIN_PASSWORD,
        "grant_type": "password",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(token_url, data=payload)
        if res.status_code != 200:
            logger.error(f"Failed to acquire Keycloak admin token: {res.status_code} {res.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to authenticate with Keycloak identity provider",
            )
        return res.json().get("access_token")


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user in Keycloak with required TOTP MFA",
)
async def register_user(req: RegisterRequest):
    admin_token = await get_keycloak_admin_token()

    name_parts = req.name.strip().split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    users_url = f"{settings.KEYCLOAK_URL}/admin/realms/{settings.KEYCLOAK_REALM}/users"
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    }
    user_payload = {
        "username": req.email.lower().strip(),
        "email": req.email.lower().strip(),
        "firstName": first_name,
        "lastName": last_name,
        "enabled": True,
        "emailVerified": True,
        "credentials": [
            {
                "type": "password",
                "value": req.password,
                "temporary": False,
            }
        ],
        "requiredActions": ["CONFIGURE_TOTP"],
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.post(users_url, json=user_payload, headers=headers)
        if res.status_code == 409:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email address already exists in Keycloak.",
            )
        if res.status_code not in (201, 204):
            logger.error(f"Keycloak user creation failed: {res.status_code} {res.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Keycloak registration error: {res.text}",
            )

        # Extract created user ID from Location header
        location_header = res.headers.get("Location")
        user_id = location_header.split("/")[-1] if location_header else None

        # Log audit trail event
        audit_log.record(
            action="USER_REGISTERED_KEYCLOAK",
            actor_id=user_id or "new_user",
            actor_username=req.email.lower().strip(),
            resource_id=user_id,
            details={
                "email": req.email,
                "name": req.name,
                "mfa_required": "CONFIGURE_TOTP",
                "realm": settings.KEYCLOAK_REALM,
            },
        )

        return RegisterResponse(
            status="success",
            message="User created in Keycloak successfully. TOTP enrollment is required on first login.",
            userId=user_id,
            email=req.email,
        )
