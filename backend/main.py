"""
PREDICTRA-X Sentinel FastAPI Backend
Production-minded security gateway with Keycloak JWT/JWKS validation,
Role-Based Access Control (RBAC), and SHA-256 cryptographic audit logs.
"""
import sys
import os
import time
import asyncio
from typing import Dict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Add current directory to path for clean imports
sys.path.insert(0, os.path.dirname(__file__))

from config import settings
from auth import jwks_cache
from routes.fdr import router as fdr_router, audit_router
from routes.auth_routes import router as auth_router
from routes.alert_routes import router as alert_router
from telemetry_ws import telemetry_hub

# ------------------------------------------------------------------------------
# Rate Limiting & Security State
# ------------------------------------------------------------------------------
RATE_LIMIT_WINDOW = 60.0  # seconds
RATE_LIMIT_MAX_REQUESTS = 120  # requests per window
ip_request_history: Dict[str, list] = {}

# ------------------------------------------------------------------------------
# Lifecycle Manager
# ------------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-fetch Keycloak JWKS if Keycloak is up, otherwise non-blocking background retry
    async def try_refresh_jwks():
        for _ in range(5):
            await jwks_cache.refresh()
            if jwks_cache.keys:
                break
            await asyncio.sleep(3)

    asyncio.create_task(try_refresh_jwks())

    # Start live telemetry stream background worker
    stream_task = asyncio.create_task(telemetry_hub.stream_loop())

    yield

    # Clean shutdown of telemetry stream
    stream_task.cancel()


app = FastAPI(
    title="PREDICTRA-X Security & Verification Intelligence API",
    description="Backend service verifying FDR lifecycle events with Keycloak OIDC PKCE + TOTP integration.",
    version="1.0.0",
    lifespan=lifespan,
)

# ------------------------------------------------------------------------------
# 1. CORS Configuration (Explicit Whitelist)
# ------------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "Accept"],
    max_age=600,
)

# ------------------------------------------------------------------------------
# 2. Security Headers & Rate Limiting Middleware
# ------------------------------------------------------------------------------
@app.middleware("http")
async def security_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()

    # Rate limiting (skip health check)
    if not request.url.path.startswith("/health"):
        history = ip_request_history.setdefault(client_ip, [])
        # Prune old requests
        ip_request_history[client_ip] = [t for t in history if now - t < RATE_LIMIT_WINDOW]
        if len(ip_request_history[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests. Please slow down."},
                headers={"Retry-After": "30"},
            )
        ip_request_history[client_ip].append(now)

    response = await call_next(request)

    # Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    return response


# ------------------------------------------------------------------------------
# 3. Route Registration
# ------------------------------------------------------------------------------
app.include_router(fdr_router)
app.include_router(audit_router)
app.include_router(auth_router)
app.include_router(alert_router)


# ------------------------------------------------------------------------------
# 4. Health & Security Status
# ------------------------------------------------------------------------------
@app.get("/health", summary="System Health & Keycloak Identity Provider Status")
async def health_check():
    jwks_cached = len(jwks_cache.keys) > 0
    return {
        "status": "ONLINE",
        "service": "PREDICTRA-X Verification Engine",
        "timestamp": time.time(),
        "keycloak": {
            "realm": settings.KEYCLOAK_REALM,
            "issuer": settings.issuer,
            "jwks_cached": jwks_cached,
            "cached_keys_count": len(jwks_cache.keys),
        },
        "cors_origins": settings.cors_origins,
    }


# ------------------------------------------------------------------------------
# 5. Live WebSocket Telemetry Route
# ------------------------------------------------------------------------------
@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    """
    Sub-second live streaming socket pushing simulated and real FDR verification
    events, sensor performance metrics, and anomaly flags to connected dashboards.
    """
    await telemetry_hub.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                import json
                msg = json.loads(data)
                action = msg.get("action")
                if action == "trigger_scan":
                    scan = telemetry_hub.generate_simulated_scan(force_anomaly=msg.get("force_anomaly", False))
                    await websocket.send_json({
                        "type": "MANUAL_SCAN_RESULT",
                        "scan": scan,
                    })
                elif action == "ping":
                    await websocket.send_json({"type": "PONG", "timestamp": time.time()})
            except Exception as parse_err:
                pass
    except WebSocketDisconnect:
        telemetry_hub.disconnect(websocket)
    except Exception:
        telemetry_hub.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
