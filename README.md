# Predictra-X (SENTRA)

Predictra-X is an enterprise security and risk prediction platform equipped with a four-layer verification core, Keycloak-based OpenID Connect (OIDC) identity management with TOTP multi-factor authentication (MFA), FastAPI backend with cryptographic audit chains, and a modern React + TypeScript frontend.

---

## 🏛️ Architecture Overview

- **Frontend (`predictra-app/`)**: Built with React, TypeScript, Vite, Tailwind CSS, Framer Motion, and Keycloak JS adapter with PKCE S256 verification.
- **Backend (`backend/`)**: High-performance FastAPI server providing REST endpoints, role-based access control (RBAC), and SHA-256 tamper-evident audit logging.
- **Identity Provider (`keycloak/`)**: Keycloak containerized service configured with the `predictra-x` realm, TOTP MFA policies, and client redirect configurations.
- **Infrastructure (`docker-compose.yml`)**: Automated orchestration for Keycloak and PostgreSQL database.

---

## 🚀 Quick Start Guide

### 1. Environment Setup

Copy `.env.example` to create local configuration:

```bash
cp .env.example .env
```

### 2. Launch Services with Docker Compose

Start Keycloak and the PostgreSQL database:

```bash
docker-compose up -d
```

Keycloak will be available at: `http://localhost:8080`
- Realm: `predictra-x`
- Client ID: `predictra-x-frontend`

### 3. Run FastAPI Backend

```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

FastAPI Swagger Documentation: `http://localhost:8000/docs`

### 4. Run Frontend Application

```bash
cd predictra-app
npm install
npm run dev
```

Frontend application will launch at: `http://localhost:5173`

---

## 🛡️ Security Features

- **PKCE S256 Authentication**: Client-side code exchange without secrets.
- **RFC 6238 TOTP Multi-Factor Authentication**: Authenticator app integration.
- **Role-Based Access Control (RBAC)**: Distinctions between operators and administrators.
- **Cryptographic Audit Chain**: SHA-256 hash chains for all sensitive operational actions.
