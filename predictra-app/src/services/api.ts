/**
 * PREDICTRA-X Secure API Client
 * Automatically attaches Keycloak Bearer access tokens to FastAPI requests.
 */
import { getValidAccessToken } from './keycloak';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface FDRRecord {
  receipt_number: string;
  issuing_bank: string;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  maturity_amount: number;
  status: string;
  layer1_evidence: string;
  layer2_calculations: string;
  layer3_bank_validation: string;
  layer4_doubtful_digits: string;
  verified_at: string;
}

export interface FDRStats {
  operator: string;
  roles: string[];
  total_receipts_scanned: number;
  verified_authentic: number;
  flagged_for_investigation: number;
  accuracy_rate: number;
  active_layers: Array<{
    layer: number;
    name: string;
    status: string;
    latency_ms: number;
  }>;
}

export interface AuditEntry {
  index: number;
  timestamp: number;
  iso_time: string;
  action: string;
  actor_id: string;
  actor_username: string;
  resource_id?: string;
  details: Record<string, unknown>;
  prev_hash: string;
  entry_hash: string;
}

export interface AuditTrailResponse {
  chain_length: number;
  integrity_verified: boolean;
  algorithm: string;
  latest_hash: string;
  entries: AuditEntry[];
}

async function requestWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getValidAccessToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    throw new Error('Unauthorized: Keycloak session expired or invalid token.');
  }

  if (response.status === 403) {
    throw new Error('Forbidden: Insufficient role permissions for this operation.');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchFDRStats(): Promise<FDRStats> {
  return requestWithAuth<FDRStats>('/api/fdr/stats');
}

export async function fetchFDRRecords(): Promise<FDRRecord[]> {
  return requestWithAuth<FDRRecord[]>('/api/fdr/records');
}

export async function executeFDRVerification(payload: {
  receipt_number: string;
  issuing_bank: string;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  maturity_amount: number;
}): Promise<Record<string, unknown>> {
  return requestWithAuth<Record<string, unknown>>('/api/fdr/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function executeFDROverride(payload: {
  receipt_number: string;
  override_reason: string;
}): Promise<Record<string, unknown>> {
  return requestWithAuth<Record<string, unknown>>('/api/fdr/override', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchAuditTrail(): Promise<AuditTrailResponse> {
  return requestWithAuth<AuditTrailResponse>('/api/audit/logs');
}

export async function checkBackendHealth(): Promise<{ status: string; keycloak: Record<string, unknown> } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (res.ok) return res.json();
    return null;
  } catch {
    return null;
  }
}
