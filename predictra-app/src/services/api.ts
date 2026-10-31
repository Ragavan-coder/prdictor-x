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

export interface SecurityAlert {
  id: string;
  timestamp: number;
  iso_time: string;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  event_type: string;
  title: string;
  description: string;
  actor: string;
  ip_address?: string;
  details: Record<string, unknown>;
  dispatched_webhook: boolean;
  dispatched_email: boolean;
}

export interface NotificationConfig {
  webhook_url?: string;
  webhook_enabled: boolean;
  email_recipient?: string;
  email_enabled: boolean;
  min_severity: string;
}

export async function fetchRecentAlerts(limit: number = 30): Promise<SecurityAlert[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/alerts/recent?limit=${limit}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchAlertConfig(): Promise<NotificationConfig> {
  const res = await fetch(`${API_BASE_URL}/api/alerts/config`);
  if (!res.ok) throw new Error('Failed to load alert config');
  return res.json();
}

export async function updateAlertConfig(config: NotificationConfig): Promise<NotificationConfig> {
  const res = await fetch(`${API_BASE_URL}/api/alerts/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to update alert config');
  return res.json();
}

export async function triggerTestAlert(payload: { title: string; severity: string; description: string }): Promise<SecurityAlert> {
  const res = await fetch(`${API_BASE_URL}/api/alerts/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to dispatch test alert');
  return res.json();
}

// -----------------------------------------------------------------------------
// Live WebSocket Telemetry & Cryptographic PDF Export
// -----------------------------------------------------------------------------
export interface LiveTelemetryScan {
  receipt_number: string;
  bank: string;
  bank_code: string;
  principal: number;
  interest_rate: number;
  tenure_months: number;
  maturity_amount: number;
  status: 'VERIFIED_AUTHENTIC' | 'FLAGGED_ANOMALY';
  confidence_score: number;
  anomaly_title?: string | null;
  anomaly_description?: string | null;
  total_latency_ms: number;
  layer_breakdown: {
    layer1_evidence: string;
    layer2_calc: string;
    layer3_bank: string;
    layer4_digits: string;
  };
  timestamp: number;
  iso_time: string;
  verified_by?: string;
}

export interface TelemetryMetrics {
  throughput_fps: number;
  avg_latency_ms: number;
  anomaly_rate_pct: number;
  total_scanned: number;
  connected_peers: number;
}

export function getTelemetryWebSocketUrl(): string {
  if (API_BASE_URL.startsWith('http')) {
    try {
      const url = new URL(API_BASE_URL);
      return `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/ws/telemetry`;
    } catch {
      return 'ws://localhost:8000/ws/telemetry';
    }
  }
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${window.location.host}/ws/telemetry`;
}

export async function downloadAuditPdf(): Promise<void> {
  const token = await getValidAccessToken();
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE_URL}/api/audit/export-pdf`, {
    headers,
  });
  if (!res.ok) {
    throw new Error(`Failed to export audit PDF: ${res.statusText}`);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sentra_cryptographic_audit_${Date.now()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// -----------------------------------------------------------------------------
// FDR Dashboard & Universal Reading Engine Service Methods
// -----------------------------------------------------------------------------
export interface DashboardSummaryResponse {
  overview: {
    total_fdr_records: number;
    total_principal_amount: number;
    successfully_processed_documents: number;
    pending_verification: number;
    flagged_anomalies: number;
    upcoming_maturity_count: number;
  };
  upcoming_maturities: Array<{
    id: string;
    fdr_number: string;
    bank_name: string;
    principal_amount: number;
    maturity_date: string;
    maturity_amount: number;
    days_remaining: number;
    verification_status: string;
  }>;
  recent_activity: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    status: string;
  }>;
  database_connected: boolean;
  server_time: string;
}

export interface FDRTableRecord {
  id: string;
  receipt_number: string;
  bank_name: string;
  branch_name?: string;
  ifsc_code?: string;
  account_holder?: string;
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  tenure_display?: string;
  compounding_frequency: string;
  issue_date: string;
  maturity_date: string;
  maturity_amount: number;
  currency: string;
  verification_status: string;
  document_id?: string;
  layer1_evidence?: string;
  layer2_calculations?: string;
  layer3_bank_validation?: string;
  layer4_doubtful_digits?: string;
  created_at?: string;
}

export interface DocumentRecord {
  document_id: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  sha256_hash: string;
  uploaded_by: string;
  uploaded_at: string;
  processing_status: string;
  extraction_status: string;
  progress_pct: number;
  current_stage: string;
}

export interface ExtractionFieldItem {
  id: string;
  field_key: string;
  field_label: string;
  original_value: string;
  current_value: string;
  source_page: number;
  bounding_box: [number, number, number, number] | null; // [ymin, xmin, ymax, xmax]
  ocr_confidence: number;
  extraction_method: string;
  review_status: 'ACCEPTED' | 'EDITED' | 'UNCERTAIN' | 'MANUAL_REVIEW_REQUESTED' | 'PENDING';
  is_edited: boolean;
  last_reviewed_by?: string;
}

export interface ExtractionDetailsResponse {
  document_id: string;
  extraction_id?: string;
  status: string;
  has_extraction?: boolean;
  extraction_confidence?: number;
  tool_pipeline?: string;
  parsing_latency_ms?: number;
  fdr_record?: {
    id: string;
    receipt_number: string;
    bank_name: string;
    branch_name: string;
    principal_amount: number;
    interest_rate: number;
    maturity_date: string;
    maturity_amount: number;
    verification_status: string;
  };
  fields: ExtractionFieldItem[];
}

export interface DocumentStatusResponse {
  document_id: string;
  processing_status: string;
  current_stage: string;
  progress_pct: number;
  error_message?: string | null;
  completed: boolean;
}

export async function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  return requestWithAuth<DashboardSummaryResponse>('/api/dashboard/summary');
}

export async function fetchFDRTableRecords(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
} = {}): Promise<{ total: number; page: number; page_size: number; records: FDRTableRecord[] }> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.pageSize) query.set('page_size', params.pageSize.toString());
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.sortBy) query.set('sort_by', params.sortBy);
  if (params.sortOrder) query.set('sort_order', params.sortOrder);

  return requestWithAuth(`/api/fdr?${query.toString()}`);
}

export async function fetchFDRRecordDetail(id: string): Promise<FDRTableRecord> {
  return requestWithAuth<FDRTableRecord>(`/api/fdr/${id}`);
}

export async function fetchDocuments(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
} = {}): Promise<{ total: number; page: number; page_size: number; documents: DocumentRecord[] }> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.pageSize) query.set('page_size', params.pageSize.toString());
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);

  return requestWithAuth(`/api/documents?${query.toString()}`);
}

export async function fetchDocumentStatus(documentId: string): Promise<DocumentStatusResponse> {
  return requestWithAuth<DocumentStatusResponse>(`/api/documents/${documentId}/status`);
}

export async function fetchDocumentExtraction(documentId: string): Promise<ExtractionDetailsResponse> {
  return requestWithAuth<ExtractionDetailsResponse>(`/api/documents/${documentId}/extraction`);
}

export async function uploadFDRDocument(file: File): Promise<{
  success: boolean;
  message: string;
  is_duplicate?: boolean;
  existing_document_id?: string;
  document?: DocumentRecord;
}> {
  const token = await getValidAccessToken();
  const formData = new FormData();
  formData.append('file', file);

  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/api/documents/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (res.status === 409) {
    const dupData = await res.json();
    return {
      success: false,
      is_duplicate: true,
      message: dupData.message,
      existing_document_id: dupData.existing_document_id,
    };
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Document upload failed.');
  }

  return res.json();
}

export async function reviewExtractionFields(
  documentId: string,
  fields: Array<{
    field_key: string;
    new_value?: string;
    review_status: 'ACCEPTED' | 'EDITED' | 'UNCERTAIN' | 'MANUAL_REVIEW_REQUESTED';
    notes?: string;
  }>,
  notes?: string
): Promise<{ success: boolean; message: string; updated_count: number }> {
  return requestWithAuth(`/api/documents/${documentId}/extraction/review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields, reviewer_notes: notes }),
  });
}

export async function triggerDocumentProcessing(documentId: string): Promise<{ success: boolean; message: string }> {
  return requestWithAuth(`/api/documents/${documentId}/process`, {
    method: 'POST',
  });
}

export function getDocumentPreviewUrl(documentId: string): string {
  return `${API_BASE_URL}/api/documents/${documentId}/preview`;
}

// =============================================================================
// PHASE 1: SENTRA 4-LAYER VERIFICATION & AUTO-REPAIR
// =============================================================================

export interface VerificationFindingItem {
  id?: string;
  layer_number: number;
  finding_type: string;
  field_key?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  explanation: string;
  bounding_box?: number[] | null;
  detection_method: string;
  confidence?: number;
  evidence_data?: any;
}

export interface VerificationResultsResponse {
  success: boolean;
  fdr_id: string;
  receipt_number: string;
  bank_name: string;
  principal_amount: number;
  maturity_amount: number;
  overall_status: string;
  risk_score: number;
  risk_severity: string;
  bank_confirmation_status: string;
  layer_statuses: {
    layer1: string;
    layer2: string;
    layer3: string;
    layer4: string;
  };
  summary_explanation?: string;
  visual_evidence_summary?: any;
  mathematical_details?: any;
  bank_verification_details?: any;
  findings_by_layer: Record<number, VerificationFindingItem[]>;
  total_findings: number;
  verified_at?: string;
}

export type FDRRecordModelItem = FDRTableRecord;

export interface AutoRepairProposalItem {
  id: string;
  field_key: string;
  field_label: string;
  original_value: string;
  proposed_value: string;
  final_approved_value?: string;
  reason: string;
  model_method: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by?: string;
  created_at?: string;
}

export async function runSentraVerification(fdrId: string): Promise<any> {
  return requestWithAuth(`/api/sentra/${fdrId}/verify`, { method: 'POST' });
}

export async function fetchSentraResults(fdrId: string): Promise<VerificationResultsResponse> {
  return requestWithAuth(`/api/sentra/${fdrId}/results`);
}

export async function fetchRepairProposals(fdrId: string): Promise<{ fdr_id: string; count: number; proposals: AutoRepairProposalItem[] }> {
  return requestWithAuth(`/api/sentra/${fdrId}/proposals`);
}

export async function reviewRepairProposal(proposalId: string, action: 'APPROVE' | 'REJECT', notes?: string): Promise<any> {
  return requestWithAuth(`/api/sentra/auto-repair/${proposalId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, notes }),
  });
}

// =============================================================================
// PHASE 2: SENTRA AI GUARDIAN & ANOMALIES
// =============================================================================

export interface AnomalyItem {
  id: string;
  fdr_id: string;
  fdr_ref?: string;
  bank_name?: string;
  anomaly_type: string;
  field_name: string;
  original_value: string;
  detected_value_or_pattern: string;
  evidence_coords?: number[];
  detection_method: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason_for_flagging: string;
  recommended_action: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  resolved_by?: string;
  created_at?: string;
}

export async function fetchGuardianAnalysis(fdrId: string): Promise<any> {
  return requestWithAuth(`/api/guardian/${fdrId}/analysis`);
}

export async function fetchAnomalies(params: { status?: string; severity?: string; limit?: number } = {}): Promise<{ total: number; count: number; anomalies: AnomalyItem[] }> {
  const q = new URLSearchParams();
  if (params.status) q.append('status', params.status);
  if (params.severity) q.append('severity', params.severity);
  if (params.limit) q.append('limit', String(params.limit));
  return requestWithAuth(`/api/anomalies?${q.toString()}`);
}

export async function resolveAnomaly(anomalyId: string, status: 'RESOLVED' | 'FALSE_POSITIVE', notes?: string): Promise<any> {
  return requestWithAuth(`/api/anomalies/${anomalyId}/resolve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes }),
  });
}

// =============================================================================
// PHASE 5: DUPLICATE INTELLIGENCE
// =============================================================================

export interface DuplicateMatchItem {
  id: string;
  match_level: 'LEVEL_1_EXACT_FILE' | 'LEVEL_2_NEAR_DUPLICATE' | 'LEVEL_3_FINANCIAL_RECORD';
  similarity_score: number;
  primary_fdr_id: string;
  primary_ref: string;
  primary_bank: string;
  primary_principal: number;
  duplicate_fdr_id: string;
  duplicate_ref: string;
  duplicate_bank: string;
  duplicate_principal: number;
  matched_fields: string[];
  conflicting_fields: string[];
  recommended_action: string;
  status: string;
  reviewed_by?: string;
  created_at?: string;
}

export async function fetchDuplicates(matchLevel?: string): Promise<{ count: number; duplicates: DuplicateMatchItem[] }> {
  const q = matchLevel ? `?match_level=${matchLevel}` : '';
  return requestWithAuth(`/api/duplicates${q}`);
}

export async function fetchDuplicateDetail(duplicateId: string): Promise<any> {
  return requestWithAuth(`/api/duplicates/${duplicateId}`);
}

export async function reviewDuplicate(duplicateId: string, action: string, notes?: string): Promise<any> {
  return requestWithAuth(`/api/duplicates/${duplicateId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, notes }),
  });
}

// =============================================================================
// PHASE 4: RISK INTELLIGENCE
// =============================================================================

export interface RiskAssessmentResponse {
  fdr_id: string;
  receipt_number: string;
  bank_name: string;
  classification: string;
  severity: string;
  composite_risk_score: number;
  decision_explanation: string;
  factor_scores: Record<string, number>;
  risk_indicators: string[];
  total_findings_count: number;
  total_anomalies_count: number;
  total_duplicates_count: number;
  bank_confirmation_status: string;
}

export async function fetchRiskAssessment(fdrId: string): Promise<RiskAssessmentResponse> {
  return requestWithAuth(`/api/risk/${fdrId}`);
}

// =============================================================================
// PHASE 6: NOTIFICATIONS & EMAIL ALERTS
// =============================================================================

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: 'INFO' | 'HIGH' | 'CRITICAL';
  category: string;
  is_read: boolean;
  action_link?: string;
  fdr_ref?: string;
  bank_name?: string;
  created_at?: string;
}

export async function fetchNotifications(unreadOnly = false, minSeverity?: string): Promise<{ total_unread: number; count: number; notifications: NotificationItem[] }> {
  const q = new URLSearchParams();
  if (unreadOnly) q.append('unread_only', 'true');
  if (minSeverity) q.append('min_severity', minSeverity);
  return requestWithAuth(`/api/notifications?${q.toString()}`);
}

export async function markNotificationRead(id: string): Promise<any> {
  return requestWithAuth(`/api/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead(): Promise<any> {
  return requestWithAuth('/api/notifications/mark-all-read', { method: 'POST' });
}

export async function triggerTestEmail(recipient?: string, fdrRef?: string, severity?: string): Promise<any> {
  return requestWithAuth('/api/alerts/test-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient, fdr_ref: fdrRef, severity }),
  });
}

// =============================================================================
// PHASE 7: FDR LIFECYCLE MONITORING
// =============================================================================

export interface LifecycleSummaryResponse {
  total_fdrs: number;
  total_principal_sum: number;
  expiring_30_days_count: number;
  expiring_90_days_count: number;
  expired_count: number;
  upcoming_30_days: any[];
  upcoming_90_days: any[];
  expired_records: any[];
  recent_events: any[];
}

export async function fetchLifecycleSummary(): Promise<LifecycleSummaryResponse> {
  return requestWithAuth('/api/lifecycle');
}

export async function fetchCalendarEvents(year?: number): Promise<{ count: number; events: any[] }> {
  const q = year ? `?year=${year}` : '';
  return requestWithAuth(`/api/lifecycle/calendar${q}`);
}

export async function recordLifecycleAction(
  fdrId: string,
  actionType: 'RENEWED' | 'REPLACED' | 'CLOSED',
  newMaturityDate?: string,
  newPrincipal?: number,
  notes?: string
): Promise<any> {
  return requestWithAuth(`/api/lifecycle/${fdrId}/renewal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_type: actionType, new_maturity_date: newMaturityDate, new_principal: newPrincipal, notes }),
  });
}

// =============================================================================
// PHASE 8: AUDIT INTEGRITY
// =============================================================================

export interface AuditIntegrityResponse {
  is_valid: boolean;
  total_events: number;
  genesis_hash?: string;
  head_hash?: string;
  broken_links_count: number;
  violations: any[];
  message: string;
}

export async function verifyAuditIntegrity(): Promise<AuditIntegrityResponse> {
  return requestWithAuth('/api/audit/verify-integrity', { method: 'POST' });
}

export async function fetchFDRAuditTrail(fdrId: string): Promise<{ fdr_id: string; receipt_number: string; count: number; events: any[] }> {
  return requestWithAuth(`/api/audit/${fdrId}`);
}

// =============================================================================
// PHASE 9: INVESTIGATION REPORTS (PDF & EXCEL DOWNLOADS)
// =============================================================================

export async function downloadInvestigationPDF(fdrId: string, receiptNumber: string): Promise<void> {
  const token = await getValidAccessToken();
  const res = await fetch(`${API_BASE_URL}/api/reports/${fdrId}/pdf`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) throw new Error('Failed generating PDF investigation report');

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PREDICTRA_X_${receiptNumber}_INVESTIGATION.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function downloadInvestigationExcel(fdrId: string, receiptNumber: string): Promise<void> {
  const token = await getValidAccessToken();
  const res = await fetch(`${API_BASE_URL}/api/reports/${fdrId}/excel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) throw new Error('Failed generating Excel audit report');

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PREDICTRA_X_${receiptNumber}_AUDIT.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}



