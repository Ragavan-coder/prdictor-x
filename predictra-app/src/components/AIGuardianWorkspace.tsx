import React, { useState, useEffect } from 'react';
import {
  fetchAnomalies,
  resolveAnomaly,
  type AnomalyItem,
} from '../services/api';

export const AIGuardianWorkspace: React.FC = () => {
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyItem | null>(null);
  const [resolving, setResolving] = useState(false);
  const [notes, setNotes] = useState('');

  const loadAnomalies = () => {
    setLoading(true);
    fetchAnomalies({
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      limit: 100,
    })
      .then((res) => {
        setAnomalies(res.anomalies);
        setTotal(res.total);
      })
      .catch((err) => console.error('Failed fetching anomalies:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAnomalies();
  }, [statusFilter, severityFilter]);

  const handleResolve = async (status: 'RESOLVED' | 'FALSE_POSITIVE') => {
    if (!selectedAnomaly) return;
    setResolving(true);
    try {
      await resolveAnomaly(selectedAnomaly.id, status, notes);
      setSelectedAnomaly(null);
      setNotes('');
      loadAnomalies();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Resolution failed');
    } finally {
      setResolving(false);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'HIGH':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Masthead Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 px-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="telemetry-pill bg-purple-50 text-purple-800 border border-purple-200/80">
                AI GUARDIAN &bull; ACTIVE SHIELD
              </span>
              <span className="telemetry-pill bg-slate-100 text-slate-700 border border-slate-200">
                MULTI-MODAL ANOMALY DISCOVERY
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight font-orbitron flex items-center gap-2">
              <span className="text-[#8B1E2D]">⚡</span> SENTRA AI Guardian Workspace
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Heuristic, statistical, and perceptual analysis detecting visual tampering, unusual financial structures, and near-duplicate layouts.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => loadAnomalies()}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2 transition-all hover:border-slate-300"
            >
              <span>🔄</span> Refresh Telemetry
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 font-mono">STATUS:</span>
            <select
              aria-label="Filter Anomalies by Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 font-semibold focus:outline-none focus:border-red-500 cursor-pointer shadow-2xs"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open (Investigating)</option>
              <option value="RESOLVED">Resolved</option>
              <option value="FALSE_POSITIVE">False Positive</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 font-mono">SEVERITY:</span>
            <select
              aria-label="Filter Anomalies by Severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 font-semibold focus:outline-none focus:border-red-500 cursor-pointer shadow-2xs"
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <span className="ml-auto font-mono text-slate-500 font-bold text-xs">
            Showing {anomalies.length} of {total} flagged patterns
          </span>
        </div>
      </div>

      {/* 2. Anomalies Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 font-mono text-xs">
          Scanning portfolio anomaly vectors...
        </div>
      ) : anomalies.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <span className="text-4xl">🛡️</span>
          <h3 className="text-sm font-bold text-slate-800 mt-2">Zero Active Anomalies Detected</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            All processed FDR certificates conform to institutional baseline boundaries. No unauthorized alterations or statistical contradictions found.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {anomalies.map((anom) => (
            <div
              key={anom.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-sm border ${getSeverityBadge(anom.severity)}`}>
                        {anom.severity}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-900">
                        {anom.fdr_ref || 'Certificate'}
                      </span>
                      {anom.bank_name && (
                        <span className="text-[11px] text-slate-500">
                          &bull; {anom.bank_name}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1.5 flex items-center gap-1.5">
                      <span>⚡</span> {anom.field_name}: {anom.anomaly_type.replace(/_/g, ' ')}
                    </h3>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-slate-100 text-slate-600 font-bold">
                    {anom.status}
                  </span>
                </div>

                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1.5">
                  <div className="text-slate-600">
                    <strong className="text-slate-900">Original Value:</strong>{' '}
                    <span className="font-mono font-bold text-slate-800">{anom.original_value}</span>
                  </div>
                  <div className="text-slate-600">
                    <strong className="text-slate-900">Detected Pattern:</strong>{' '}
                    <span className="font-mono text-rose-700 font-bold">{anom.detected_value_or_pattern}</span>
                  </div>
                  <div className="text-slate-600">
                    <strong className="text-slate-900">Detection Method:</strong> {anom.detection_method}
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-700 leading-relaxed">
                  <p><strong>Reason:</strong> {anom.reason_for_flagging}</p>
                  <p className="mt-1 text-slate-500"><strong>Action:</strong> {anom.recommended_action}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[10px] font-mono text-slate-400">
                  {anom.created_at ? new Date(anom.created_at).toLocaleString() : ''}
                </span>

                {anom.status === 'OPEN' && (
                  <button
                    onClick={() => setSelectedAnomaly(anom)}
                    className="px-3 py-1.5 bg-[#C8102E] hover:bg-[#A00D24] text-white font-bold rounded-md text-xs shadow-xs"
                  >
                    Investigate & Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolution Modal — Standardized Enterprise Box */}
      {selectedAnomaly && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-[#E4E7EC] w-full max-w-[640px] lg:max-w-[680px] px-8 sm:px-12 md:px-14 py-7 sm:py-8 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 font-orbitron tracking-wide">
                Resolve Anomaly: {selectedAnomaly.field_name}
              </h3>
              <button
                onClick={() => setSelectedAnomaly(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold text-xl transition-colors cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Apply formal compliance decision on flagged anomaly for <strong className="text-slate-900">{selectedAnomaly.fdr_ref}</strong> ({selectedAnomaly.bank_name}).
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-mono">
                Auditor Resolution Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter evidence notes, bank communication reference, or ledger verification details..."
                rows={3}
                className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-[#8B1E2D] font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedAnomaly(null)}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={resolving}
                onClick={() => handleResolve('FALSE_POSITIVE')}
                className="px-5 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                Mark False Positive
              </button>
              <button
                disabled={resolving}
                onClick={() => handleResolve('RESOLVED')}
                className="px-5 py-2.5 text-xs font-bold bg-[#16845B] hover:bg-[#126b49] text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {resolving ? 'Recording...' : 'Resolve & Clear Flag'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
