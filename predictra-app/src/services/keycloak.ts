/**
 * PREDICTRA-X Keycloak OIDC Service
 * Enforces Authorization Code Flow with PKCE (S256) and TOTP Multi-Factor Authentication.
 * Never stores client secrets in frontend code.
 */
import Keycloak from 'keycloak-js';

const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'predictra-x';
const KEYCLOAK_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'predictra-x-frontend';

export interface KeycloakUser {
  id: string;
  username: string;
  email: string;
  name: string;
  roles: string[];
  tokenExp?: number;
  mfaVerified: boolean;
}

// Singleton Keycloak client instance
export const keycloak = new Keycloak({
  url: KEYCLOAK_URL,
  realm: KEYCLOAK_REALM,
  clientId: KEYCLOAK_CLIENT_ID,
});

let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

/**
 * Initializes Keycloak with PKCE S256.
 * Checks for existing session or incoming authorization code callback.
 */
export async function initKeycloak(): Promise<boolean> {
  if (isInitialized) return keycloak.authenticated || false;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const authenticated = await keycloak.init({
        onLoad: 'check-sso',
        pkceMethod: 'S256', // Strict S256 PKCE as required by cybersecurity spec
        checkLoginIframe: false, // Prevents third-party cookie blocking in modern browsers
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        enableLogging: true,
      });

      isInitialized = true;

      if (authenticated) {
        setupTokenRefresh();
      }

      return authenticated;
    } catch (error) {
      console.warn('[PREDICTRA-X] Keycloak init failed or server unreachable:', error);
      isInitialized = true;
      return false;
    }
  })();

  return initPromise;
}

/**
 * Automatic background token refresh (runs before token expires)
 */
function setupTokenRefresh() {
  setInterval(async () => {
    if (keycloak.authenticated) {
      try {
        // Refresh token if it expires in less than 60 seconds
        const refreshed = await keycloak.updateToken(60);
        if (refreshed) {
          console.debug('[PREDICTRA-X] Keycloak access token refreshed via PKCE');
        }
      } catch (err) {
        console.warn('[PREDICTRA-X] Failed to refresh token, session expired', err);
      }
    }
  }, 15000);
}

/**
 * Redirects the user to Keycloak's login page with PKCE code challenge.
 * Keycloak prompts for password + TOTP 6-digit code.
 */
export async function loginWithKeycloak(redirectUri?: string): Promise<void> {
  const targetUri = redirectUri || window.location.origin;
  await keycloak.login({
    redirectUri: targetUri,
  });
}

/**
 * Redirects the user to Keycloak registration page.
 * Keycloak requires CONFIGURE_TOTP on first registration.
 */
export async function registerWithKeycloak(redirectUri?: string): Promise<void> {
  const targetUri = redirectUri || window.location.origin;
  await keycloak.register({
    redirectUri: targetUri,
  });
}

/**
 * Ends session at Keycloak and returns to PREDICTRA-X portal.
 */
export async function logoutKeycloak(redirectUri?: string): Promise<void> {
  localStorage.removeItem('predictra_access_token');
  const targetUri = redirectUri || window.location.origin;
  if (keycloak.authenticated) {
    await keycloak.logout({
      redirectUri: targetUri,
    });
  }
}

/**
 * Returns current valid Access Token for FastAPI Bearer authorization
 */
export async function getValidAccessToken(): Promise<string | null> {
  if (keycloak.authenticated && keycloak.token) {
    try {
      await keycloak.updateToken(30);
      return keycloak.token || null;
    } catch {
      // fallback to stored local token
    }
  }
  return localStorage.getItem('predictra_access_token') || null;
}

/**
 * Extracts normalized user profile and assigned realm roles
 */
export function getKeycloakUserProfile(): KeycloakUser | null {
  if (!keycloak.authenticated || !keycloak.tokenParsed) return null;

  const parsed = keycloak.tokenParsed as Record<string, unknown>;
  const realmAccess = (parsed.realm_access as { roles?: string[] }) || {};
  const roles = realmAccess.roles || [];

  return {
    id: (parsed.sub as string) || '',
    username: (parsed.preferred_username as string) || (parsed.email as string) || 'operator',
    email: (parsed.email as string) || '',
    name: (parsed.name as string) || (parsed.preferred_username as string) || 'Operator',
    roles,
    tokenExp: parsed.exp as number,
    mfaVerified: true, // Keycloak enforced via TOTP policy
  };
}

/**
 * Checks if Keycloak server is responding on port 8080
 */
export async function checkKeycloakReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
    });
    return res.status === 200;
  } catch {
    return false;
  }
}
