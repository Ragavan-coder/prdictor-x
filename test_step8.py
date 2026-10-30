import urllib.request
import urllib.parse
import urllib.error
import http.cookiejar
import json
import re

print("=" * 60)
print("PREDICTRA-X STEP 8 VERIFICATION SUITE")
print("=" * 60)

# 1. Keycloak Admin Console
print("\n[CHECK 1] Keycloak starts and admin console opens...")
try:
    req = urllib.request.Request("http://localhost:8080/admin/master/console/")
    res = urllib.request.urlopen(req, timeout=5)
    print(f"  -> SUCCESS: Keycloak Admin Console returned HTTP {res.getcode()}")
except Exception as e:
    print(f"  -> FAILED: {e}")

# 2. Realm predictra-x exists
print("\n[CHECK 2] predictra-x realm exists...")
try:
    req = urllib.request.Request("http://localhost:8080/realms/predictra-x/.well-known/openid-configuration")
    res = urllib.request.urlopen(req, timeout=5)
    realm_cfg = json.loads(res.read().decode())
    issuer = realm_cfg.get("issuer")
    print(f"  -> SUCCESS: Realm found with Issuer: {issuer}")
except Exception as e:
    print(f"  -> FAILED: {e}")

# 3. React client configuration
print("\n[CHECK 3] predictra-x-frontend client redirect URIs...")
try:
    # Authenticate to admin-cli
    token_url = "http://localhost:8080/realms/master/protocol/openid-connect/token"
    auth_data = urllib.parse.urlencode({
        "client_id": "admin-cli",
        "username": "admin",
        "password": "ChangeThisLocalPassword123!",
        "grant_type": "password"
    }).encode()
    auth_req = urllib.request.Request(token_url, data=auth_data)
    auth_res = urllib.request.urlopen(auth_req, timeout=5)
    admin_token = json.loads(auth_res.read().decode())["access_token"]

    # Query predictra-x clients
    clients_url = "http://localhost:8080/admin/realms/predictra-x/clients?clientId=predictra-x-frontend"
    clients_req = urllib.request.Request(clients_url, headers={"Authorization": f"Bearer {admin_token}"})
    clients_res = urllib.request.urlopen(clients_req, timeout=5)
    clients = json.loads(clients_res.read().decode())
    client = clients[0]
    print(f"  -> SUCCESS: Found client: {client['clientId']}")
    print(f"     Public Client: {client.get('publicClient')}")
    print(f"     Redirect URIs: {client.get('redirectUris')}")
    print(f"     Web Origins: {client.get('webOrigins')}")
except Exception as e:
    print(f"  -> FAILED: {e}")

# 4. Protected FastAPI Endpoint Rejections
print("\n[CHECK 7] Protected FastAPI endpoint rejects missing or invalid tokens...")
try:
    req_missing = urllib.request.Request("http://localhost:8000/api/fdr/records")
    urllib.request.urlopen(req_missing, timeout=5)
    print("  -> FAILED: Request without token succeeded unexpectedly")
except urllib.error.HTTPError as e:
    print(f"  -> SUCCESS: Missing token rejected with HTTP {e.code}: {e.read().decode().strip()}")
except Exception as e:
    print(f"  -> ERROR: {e}")

try:
    req_invalid = urllib.request.Request(
        "http://localhost:8000/api/fdr/records",
        headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.token"}
    )
    urllib.request.urlopen(req_invalid, timeout=5)
    print("  -> FAILED: Request with forged token succeeded unexpectedly")
except urllib.error.HTTPError as e:
    print(f"  -> SUCCESS: Invalid token rejected with HTTP {e.code}: {e.read().decode().strip()}")
except Exception as e:
    print(f"  -> ERROR: {e}")

print("\n" + "=" * 60)
