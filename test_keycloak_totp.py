import urllib.request
import urllib.parse
import http.cookiejar
import re

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

# 1. Start OIDC auth flow
params = {
    'client_id': 'predictra-x-frontend',
    'redirect_uri': 'http://localhost:5173/',
    'response_type': 'code',
    'scope': 'openid profile email'
}
auth_url = 'http://localhost:8080/realms/predictra-x/protocol/openid-connect/auth?' + urllib.parse.urlencode(params)
res = opener.open(auth_url)
html = res.read().decode('utf-8')
print("1. Initial Auth status:", res.getcode())

# Find form action
action_match = re.search(r'action="([^"]+)"', html)
if not action_match:
    print("No action found!")
    exit(1)

login_action_url = action_match.group(1).replace('&amp;', '&')
print("2. Login Action URL found")

# Submit credentials for admin@predictra.x
login_data = urllib.parse.urlencode({
    'username': 'admin@predictra.x',
    'password': 'SentraAdmin#2026!',
    'credentialId': ''
}).encode()

req = urllib.request.Request(login_action_url, data=login_data, headers={
    'Content-Type': 'application/x-www-form-urlencoded'
})
res = opener.open(req)
html2 = res.read().decode('utf-8')
print("3. Post-Login URL:", res.geturl())
print("   Page content snippet:", html2[:300].replace('\n', ' '))

# Check if CONFIGURE_TOTP page is presented
totp_action_match = re.search(r'action="([^"]+)"', html2)
has_totp_form = 'totp' in html2.lower() or 'authenticator' in html2.lower()
print(f"4. Prompts for TOTP setup: {has_totp_form}")

# Extract secret key if present
secret_match = re.search(r'([A-Z2-7]{16,32})', html2)
if secret_match:
    print(f"   Keycloak TOTP Secret detected: {secret_match.group(1)}")

if totp_action_match:
    totp_action_url = totp_action_match.group(1).replace('&amp;', '&')
    
    # Test submitting an INVALID OTP code (e.g. 000000)
    print("\n5. Testing submitting INVALID OTP (000000) to Keycloak...")
    bad_data = urllib.parse.urlencode({
        'totp': '000000',
        'userLabel': 'TestDevice'
    }).encode()
    bad_req = urllib.request.Request(totp_action_url, data=bad_data, headers={
        'Content-Type': 'application/x-www-form-urlencoded'
    })
    try:
        bad_res = opener.open(bad_req)
        bad_html = bad_res.read().decode('utf-8')
        rejected = 'invalid' in bad_html.lower() or 'error' in bad_html.lower() or bad_res.getcode() != 302
        print(f"   -> Result: Invalid OTP rejected? {rejected}")
        # Search for error message text
        err_match = re.findall(r'alert-error.*?<span[^>]*>(.*?)</span>', bad_html, re.S)
        if err_match:
            print(f"   -> Keycloak error message: {err_match[0].strip()}")
    except urllib.error.HTTPError as e:
        print(f"   -> HTTP status {e.code}")
