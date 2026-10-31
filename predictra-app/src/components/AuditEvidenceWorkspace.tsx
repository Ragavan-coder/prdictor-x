import React, { useState, useEffect } from 'react';
import {
  fetchAuditTrail,
  verifyAuditIntegrity,
  type AuditEntry,
  type AuditIntegrityResponse,
} from '../services/api';

export const AuditEvidenceWorkspace: React.FC = () => {
  const [events, setEvents] = useState<AuditEntry[]>([]);
  const [integrity, setIntegrity] = useState<AuditIntegrityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [search, setSearch] = useState('');

  const loadTrail = () => {
    setLoading(true);
    fetchAuditTrail()
      .then((res) => {
        setEvents(res.entries || []);
      })
      .catch((err) => console.error('Failed fetching audit trail:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTrail();
  }, []);

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    try {
      const res = await verifyAuditIntegrity();
      setIntegrity(res);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const filtered = events.filter((e) => {
    const s = search.toLowerCase();
    return (
      e.action.toLowerCase().includes(s) ||
      e.actor_username.toLowerCase().includes(s) ||
      (e.resource_id && e.resource_id.toLowerCase().includes(s)) ||
      e.entry_hash.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs p-5 px-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="telemetry-pill bg-slate-100 text-[#20242C] border border-[#E4E7EC]">
                PHASE 8 CRYPTOGRAPHIC EVIDENCE
              </span>
              <span className="telemetry-pill bg-slate-100 text-[#667085] border border-[#E4E7EC]">
                SHA-256 MERKLE HASH CHAIN
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#20242C] tracking-tight">
              Cryptographic Audit Trail &amp; Evidence Chain
            </h1>
            <p className="text-xs text-[#667085] font-medium mt-1">
              Immutable hash-chained blocks recording logins, uploads, verifications, auto-repairs, and report generation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleVerifyIntegrity}
              disabled={verifying}
              className="px-5 py-2.5 bg-[#8B1E2D] hover:bg-[#6F1724] text-white text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {verifying && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <span>{verifying ? 'Verifying Chain...' : 'Verify Chain Integrity'}</span>
            </button>
          </div>
        </div>

        {/* Verification Status Banner */}
        {integrity && (
          <div className={`mt-4 p-4 rounded-xl border flex items-center justify-between gap-4 ${
            integrity.is_valid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-[#8B1E2D]/10 border-[#8B1E2D]/30 text-[#8B1E2D]'
          }`}>
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center font-bold text-xs shadow-2xs">
                {integrity.is_valid ? '✓' : '✕'}
              </span>
              <div>
                <h4 className="text-xs font-bold font-mono tracking-tight uppercase">
                  {integrity.is_valid ? 'Cryptographic Audit Integrity 100% Intact' : 'Integrity Compromise Detected'}
                </h4>
                <p className="text-xs mt-0.5">{integrity.message}</p>
              </div>
            </div>
            <div className="text-right text-[11px] font-mono">
              <div>Total Blocks Verified: <strong>{integrity.total_events}</strong></div>
              {integrity.head_hash && (
                <div className="text-[#667085]">Head: {integrity.head_hash.slice(0, 16)}...</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Audit Blocks Explorer */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#E4E7EC] bg-slate-50/60 flex items-center justify-between gap-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, actor, resource ID, or hash..."
            className="text-xs bg-white border border-[#E4E7EC] rounded-xl px-3.5 py-2 w-full max-w-sm focus:outline-hidden focus:border-[#8B1E2D]"
          />
          <span className="text-xs font-mono text-[#667085]">
            Showing {filtered.length} of {events.length} blocks
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-100 text-[#667085] uppercase tracking-wider text-[10px] border-b border-[#E4E7EC]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Block #</th>
                <th className="py-2.5 px-3 font-semibold">Action</th>
                <th className="py-2.5 px-3 font-semibold">Actor</th>
                <th className="py-2.5 px-3 font-semibold">Resource Reference</th>
                <th className="py-2.5 px-3 font-semibold">Current Entry SHA-256</th>
                <th className="py-2.5 px-3 font-semibold">Predecessor Hash</th>
                <th className="py-2.5 px-3 font-semibold">Timestamp (UTC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#667085]">
                    Loading cryptographic ledger...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#667085]">
                    No matching audit blocks.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.index} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-bold text-[#20242C]">#{e.index}</td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-[#8B1E2D] bg-[#8B1E2D]/10 px-2 py-0.5 rounded-sm border border-[#8B1E2D]/20">
                        {e.action}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#20242C] font-semibold">{e.actor_username}</td>
                    <td className="py-3 px-3 text-[#667085] truncate max-w-[140px]">{e.resource_id || '—'}</td>
                    <td className="py-3 px-3 text-[#20242C] font-bold truncate max-w-[150px]" title={e.entry_hash}>
                      {e.entry_hash.slice(0, 16)}...
                    </td>
                    <td className="py-3 px-3 text-[#667085] truncate max-w-[150px]" title={e.prev_hash}>
                      {e.prev_hash.slice(0, 16)}...
                    </td>
                    <td className="py-3 px-3 text-[#667085] whitespace-nowrap">{e.iso_time}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
