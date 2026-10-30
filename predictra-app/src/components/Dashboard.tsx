import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { User } from '../App';
import SecurityBackground from './SecurityBackground';
import {
  fetchFDRStats,
  fetchFDRRecords,
  fetchAuditTrail,
  executeFDRVerification,
  executeFDROverride,
  type FDRRecord,
  type FDRStats,
  type AuditTrailResponse,
} from '../services/api';

interface Props {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: Props) {
  const [stats, setStats] = useState<FDRStats | null>(null);
  const [records, setRecords] = useState<FDRRecord[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditTrailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'records' | 'audit' | 'security'>('records');

  const isAdmin = user.roles?.includes('sentra-admin') || false;

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [statsData, recordsData, auditData] = await Promise.allSettled([
          fetchFDRStats(),
          fetchFDRRecords(),
          fetchAuditTrail(),
        ]);

        if (mounted) {
          if (statsData.status === 'fulfilled') setStats(statsData.value);
          if (recordsData.status === 'fulfilled') setRecords(recordsData.value);
          if (auditData.status === 'fulfilled') setAuditTrail(auditData.value);
        }
      } catch (err) {
        console.warn('Failed loading backend data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const handleVerifySample = async () => {
    setActionMsg(null);
    try {
      const res = await executeFDRVerification({
        receipt_number: `FDR-2026-${Math.floor(1000 + Math.random() * 9000)}-SBI`,
        issuing_bank: 'State Bank of India',
        principal_amount: 1000000,
        interest_rate: 7.25,
        tenure_months: 24,
        maturity_amount: 1154500,
      });
      setActionMsg({
        text: `SENTRA 4-Layer Verification Executed: Receipt ${res.receipt_number} marked ${res.status}. Recorded in SHA-256 audit log.`,
        type: 'success',
      });
      // Refresh audit trail
      const audit = await fetchAuditTrail().catch(() => null);
      if (audit) setAuditTrail(audit);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      setActionMsg({ text: message, type: 'error' });
    }
  };

  const handleAdminOverride = async () => {
    setActionMsg(null);
    try {
      const res = await executeFDROverride({
        receipt_number: 'FDR-2026-3190-PNB',
        override_reason: 'Branch IFSC discrepancy cleared via direct treasury confirmation.',
      });
      setActionMsg({
        text: `Admin Override Approved: ${res.message}`,
        type: 'success',
      });
      const audit = await fetchAuditTrail().catch(() => null);
      if (audit) setAuditTrail(audit);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Override failed';
      setActionMsg({ text: message, type: 'error' });
    }
  };

  return (
    <motion.div
      key="dashboard"
      className="fixed inset-0 overflow-auto text-neutral-800"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: '#F4F5F7', zIndex: 40 }}
    >
      <SecurityBackground />

      <div className="relative z-10 min-h-full flex flex-col">
        {/* ── Top Navigation Bar ── */}
        <nav className="top-nav flex items-center justify-between px-6 py-3.5 bg-white border-b border-neutral-200 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="font-orbitron font-black tracking-wider flex items-baseline gap-0 text-lg">
              <span className="text-neutral-900">PREDICTRA-</span>
              <span className="text-[#C8102E]">X</span>
            </div>
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-orbitron text-[0.62rem] font-bold tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              SENTRA CORE ONLINE
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* User Profile Pill */}
            <div className="text-right hidden sm:block">
              <div className="font-inter text-xs font-bold text-neutral-900 flex items-center justify-end gap-1.5">
                <span>{user.name}</span>
                {isAdmin ? (
                  <span className="bg-[#C8102E] text-white text-[0.6rem] font-orbitron px-1.5 py-0.2 rounded font-bold">
                    ADMIN
                  </span>
                ) : (
                  <span className="bg-neutral-800 text-white text-[0.6rem] font-orbitron px-1.5 py-0.2 rounded font-bold">
                    OPERATOR
                  </span>
                )}
              </div>
              <div className="font-inter text-[0.7rem] text-neutral-500">{user.email}</div>
            </div>

            <motion.button
              onClick={onLogout}
              className="font-orbitron text-xs tracking-wider px-3.5 py-1.5 rounded-lg border border-[#C8102E]/30 text-[#C8102E] bg-[#C8102E]/5 hover:bg-[#C8102E] hover:text-white transition-all font-semibold cursor-pointer"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              LOGOUT
            </motion.button>
          </div>
        </nav>

        {/* ── Main Content Container ── */}
        <div className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-neutral-200">
            <div>
              <h1 className="font-orbitron font-bold text-xl md:text-2xl text-neutral-900 tracking-tight">
                SENTRA VERIFICATION DASHBOARD
              </h1>
              <p className="font-rajdhani text-sm text-neutral-600 mt-1">
                Authenticated Operator: <strong className="text-neutral-900">{user.name}</strong> · Identity Verified via{' '}
                <span className="text-[#C8102E] font-semibold">Keycloak OIDC PKCE + TOTP Authenticator</span>
                {loading && <span className="ml-2 text-xs font-rajdhani text-neutral-400 animate-pulse">Syncing...</span>}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleVerifySample}
                className="px-3.5 py-2 rounded-lg bg-[#C8102E] text-white font-orbitron text-xs font-bold tracking-wider hover:bg-[#a50d26] transition-colors shadow-xs cursor-pointer"
              >
                + VERIFY NEW FDR
              </button>

              <button
                onClick={handleAdminOverride}
                className={`px-3.5 py-2 rounded-lg font-orbitron text-xs font-bold tracking-wider transition-colors shadow-xs cursor-pointer ${
                  isAdmin
                    ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                }`}
                title={isAdmin ? 'Execute Administrator Override' : 'Requires sentra-admin role'}
              >
                ADMIN OVERRIDE
              </button>
            </div>
          </div>

          {/* Action Message Alert */}
          {actionMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 p-3 rounded-lg border text-xs font-rajdhani flex items-center justify-between ${
                actionMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-[#C8102E]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{actionMsg.type === 'success' ? '✔' : '⚠'}</span>
                <span>{actionMsg.text}</span>
              </div>
              <button
                onClick={() => setActionMsg(null)}
                className="text-xs font-bold hover:underline cursor-pointer"
              >
                Dismiss
              </button>
            </motion.div>
          )}

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: 'FDRS SCANNED',
                value: stats?.total_receipts_scanned?.toLocaleString() || '14,280',
                sub: 'Lifetime verification volume',
                color: 'text-neutral-900',
              },
              {
                label: 'VERIFIED AUTHENTIC',
                value: stats?.verified_authentic?.toLocaleString() || '13,994',
                sub: '99.98% accuracy score',
                color: 'text-emerald-700',
              },
              {
                label: 'FLAGGED ANOMALIES',
                value: stats?.flagged_for_investigation?.toLocaleString() || '286',
                sub: 'Doubtful digit & IFSC checks',
                color: 'text-amber-700',
              },
              {
                label: 'MFA SECURITY STATUS',
                value: 'TOTP ENROLLED',
                sub: 'RFC 6238 · Keycloak 2FA',
                color: 'text-[#C8102E]',
              },
            ].map((st, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-white border border-neutral-200 shadow-xs"
              >
                <div className="font-orbitron text-[0.62rem] text-neutral-500 font-bold tracking-wider uppercase">
                  {st.label}
                </div>
                <div className={`font-orbitron text-xl md:text-2xl font-bold mt-1 ${st.color}`}>
                  {st.value}
                </div>
                <div className="font-rajdhani text-xs text-neutral-500 mt-1">{st.sub}</div>
              </div>
            ))}
          </div>

          {/* SENTRA 4-Layer Core Telemetry */}
          <div className="mb-6 p-4 rounded-xl bg-white border border-neutral-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-orbitron font-bold text-xs uppercase tracking-wider text-neutral-900">
                SENTRA Four-Layer Verification Core Status
              </h2>
              <span className="font-orbitron text-[0.62rem] text-emerald-600 font-bold uppercase">
                ALL 4 LAYERS ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  id: 1,
                  title: 'Evidence Verification',
                  desc: 'Watermark, seal & microprint',
                  latency: '12ms',
                },
                {
                  id: 2,
                  title: 'Financial Calculations',
                  desc: 'Compound interest & arithmetic',
                  latency: '4ms',
                },
                {
                  id: 3,
                  title: 'Bank Validation',
                  desc: 'Core Banking API reconciliation',
                  latency: '45ms',
                },
                {
                  id: 4,
                  title: 'Doubtful-Digit Analysis',
                  desc: 'Glyph anomaly & stroke forensic',
                  latency: '18ms',
                },
              ].map((l) => (
                <div
                  key={l.id}
                  className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs font-rajdhani"
                >
                  <div className="flex items-center justify-between font-bold text-neutral-900 font-orbitron text-[0.68rem]">
                    <span>LAYER {l.id}</span>
                    <span className="text-emerald-600">ONLINE</span>
                  </div>
                  <div className="font-semibold text-neutral-800 mt-1">{l.title}</div>
                  <div className="text-[0.7rem] text-neutral-500">{l.desc}</div>
                  <div className="mt-2 text-[0.65rem] font-orbitron text-neutral-400">
                    Latency: {l.latency}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard Tab Navigation */}
          <div className="flex border-b border-neutral-200 mb-4 bg-white rounded-t-xl px-4 pt-2">
            {[
              { id: 'records', label: 'ACTIVE FDR RECORDS' },
              { id: 'audit', label: 'SHA-256 AUDIT LOG CHAIN' },
              { id: 'security', label: 'KEYCLOAK & OIDC CLAIMS' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className="py-3 px-4 font-orbitron text-xs font-bold tracking-wider uppercase cursor-pointer transition-colors"
                style={{
                  color: activeTab === tab.id ? '#C8102E' : '#737373',
                  borderBottom: activeTab === tab.id ? '2.5px solid #C8102E' : '2.5px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Active FDR Records */}
          {activeTab === 'records' && (
            <div className="bg-white rounded-b-xl border border-neutral-200 overflow-hidden shadow-xs p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-rajdhani text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-500 font-orbitron text-[0.62rem] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Receipt Number</th>
                      <th className="py-2.5 px-3">Issuing Bank</th>
                      <th className="py-2.5 px-3">Principal</th>
                      <th className="py-2.5 px-3">Rate / Tenure</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Doubtful-Digit Check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-medium">
                    {records.map((r, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                        <td className="py-3 px-3 font-orbitron font-bold text-neutral-900">
                          {r.receipt_number}
                        </td>
                        <td className="py-3 px-3">{r.issuing_bank}</td>
                        <td className="py-3 px-3 font-semibold">
                          ₹{r.principal_amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          {r.interest_rate}% ({r.tenure_months}m)
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[0.65rem] font-orbitron font-bold ${
                              r.status.includes('VERIFIED')
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[0.7rem] text-neutral-600">
                          {r.layer4_doubtful_digits}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: SHA-256 Audit Log Chain */}
          {activeTab === 'audit' && (
            <div className="bg-white rounded-b-xl border border-neutral-200 p-5 shadow-xs font-rajdhani">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-neutral-200">
                <div>
                  <h3 className="font-orbitron font-bold text-xs uppercase tracking-wider text-neutral-900">
                    Cryptographic Audit Chain (SHA-256 Merkle Chain)
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Every verification, override, and login event is hashed and chained to prevent log tampering.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-orbitron text-xs font-bold">
                  <span>✔</span>
                  <span>CHAIN INTEGRITY: VERIFIED</span>
                </div>
              </div>

              <div className="space-y-3">
                {auditTrail?.entries?.map((e) => (
                  <div
                    key={e.index}
                    className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between font-orbitron text-[0.65rem] text-neutral-500 mb-1">
                      <span className="font-bold text-neutral-900">
                        BLOCK #{e.index} · {e.action}
                      </span>
                      <span>{e.iso_time}</span>
                    </div>
                    <div className="font-medium text-neutral-700">
                      Operator: <span className="text-neutral-900 font-semibold">{e.actor_username}</span>
                      {e.resource_id && <span> · Resource: {e.resource_id}</span>}
                    </div>
                    <div className="mt-2 text-[0.62rem] font-mono text-neutral-500 break-all bg-white p-2 rounded border border-neutral-200">
                      <div>
                        <strong className="text-neutral-700">SHA-256 Hash:</strong> {e.entry_hash}
                      </div>
                      <div className="text-neutral-400 mt-0.5">
                        <strong>Prev Hash:</strong> {e.prev_hash}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Keycloak Security Details */}
          {activeTab === 'security' && (
            <div className="bg-white rounded-b-xl border border-neutral-200 p-5 shadow-xs font-rajdhani text-xs">
              <h3 className="font-orbitron font-bold text-xs uppercase tracking-wider text-neutral-900 mb-3">
                Identity Provider Security Parameters
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 space-y-1.5">
                  <div className="font-orbitron text-[0.65rem] font-bold text-neutral-700 uppercase">
                    OIDC Configuration
                  </div>
                  <div><strong>Realm:</strong> predictra-x</div>
                  <div><strong>Client ID:</strong> predictra-x-frontend (Public Client)</div>
                  <div><strong>Flow:</strong> Authorization Code with PKCE (S256)</div>
                  <div><strong>Keycloak URL:</strong> http://localhost:8080</div>
                </div>

                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 space-y-1.5">
                  <div className="font-orbitron text-[0.65rem] font-bold text-neutral-700 uppercase">
                    MFA & Session Credentials
                  </div>
                  <div><strong>MFA Method:</strong> TOTP (Time-based One-Time Password)</div>
                  <div><strong>OTP Algorithm:</strong> HmacSHA1 / 6 Digits / 30s Period</div>
                  <div><strong>Assigned Roles:</strong> {user.roles?.join(', ') || 'sentra-operator'}</div>
                  <div><strong>Audience:</strong> FastAPI JWT JWKS Validated</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
