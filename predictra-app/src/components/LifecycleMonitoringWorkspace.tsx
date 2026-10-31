import React, { useState, useEffect } from 'react';
import {
  fetchLifecycleSummary,
  fetchCalendarEvents,
  recordLifecycleAction,
  type LifecycleSummaryResponse,
} from '../services/api';

export const LifecycleMonitoringWorkspace: React.FC = () => {
  const [summary, setSummary] = useState<LifecycleSummaryResponse | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFdrForAction, setSelectedFdrForAction] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'RENEWED' | 'REPLACED' | 'CLOSED'>('RENEWED');
  const [newMaturityDate, setNewMaturityDate] = useState('');
  const [newPrincipal, setNewPrincipal] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([fetchLifecycleSummary(), fetchCalendarEvents()])
      .then(([sRes, cRes]) => {
        setSummary(sRes);
        setCalendarEvents(cRes.events || []);
      })
      .catch((err) => console.error('Failed loading lifecycle:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExecuteAction = async () => {
    if (!selectedFdrForAction) return;
    setSubmitting(true);
    try {
      await recordLifecycleAction(
        selectedFdrForAction.fdr_id,
        actionType,
        newMaturityDate || undefined,
        newPrincipal ? Number(newPrincipal) : undefined,
        notes
      );
      setActionMsg(`Lifecycle action '${actionType}' recorded for ${selectedFdrForAction.receipt_number}!`);
      setSelectedFdrForAction(null);
      setNewMaturityDate('');
      setNewPrincipal('');
      setNotes('');
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lifecycle update failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {loading && !summary && (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-mono text-slate-500">Loading lifecycle telemetry...</p>
        </div>
      )}
      {/* Header */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs p-5 px-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="telemetry-pill bg-emerald-50 text-emerald-800 border border-emerald-200">
                PHASE 7 LIFECYCLE INTELLIGENCE
              </span>
              <span className="telemetry-pill bg-slate-100 text-[#667085] border border-[#E4E7EC]">
                SCHEDULED MATURITY DISPATCH
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#20242C] tracking-tight">
              FDR Lifecycle &amp; Maturation Monitoring
            </h1>
            <p className="text-xs text-[#667085] font-medium mt-1">
              Real-time countdown intelligence, automated reminder schedules (30d, 15d, 7d, 0d), and renewal/replacement tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-[#20242C] text-xs font-semibold rounded-xl border border-[#E4E7EC] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              Refresh Timeline
            </button>
          </div>
        </div>

        {actionMsg && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
            <span className="font-bold">✓</span> {actionMsg}
          </div>
        )}
      </div>

      {/* Metrics */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-[#E4E7EC] p-4 shadow-2xs">
            <span className="text-[11px] font-mono font-bold text-[#667085] uppercase tracking-wider">
              Total Active Portfolio
            </span>
            <div className="text-2xl font-black font-mono text-[#20242C] mt-2">
              ₹{summary.total_principal_sum?.toLocaleString()}
            </div>
            <p className="text-[11px] text-[#667085] mt-1">
              Active Deposits: <strong>{summary.total_fdrs}</strong> certificates
            </p>
          </div>

          <div className="bg-white rounded-xl border border-[#8B1E2D]/20 p-4 shadow-2xs bg-[#8B1E2D]/5">
            <span className="text-[11px] font-mono font-bold text-[#8B1E2D] uppercase tracking-wider">
              Urgent Maturity (&le; 30 Days)
            </span>
            <div className="text-2xl font-black font-mono text-[#8B1E2D] mt-2">
              {summary.expiring_30_days_count}
            </div>
            <p className="text-[11px] text-[#8B1E2D] mt-1">
              Action Required: Rollover or Closure
            </p>
          </div>

          <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-2xs bg-amber-50/30">
            <span className="text-[11px] font-mono font-bold text-amber-700 uppercase tracking-wider">
              Approaching (&le; 90 Days)
            </span>
            <div className="text-2xl font-black font-mono text-amber-800 mt-2">
              {summary.expiring_90_days_count}
            </div>
            <p className="text-[11px] text-amber-700 mt-1">
              Reminder Dispatch Armed
            </p>
          </div>

          <div className="bg-white rounded-xl border border-[#E4E7EC] p-4 shadow-2xs">
            <span className="text-[11px] font-mono font-bold text-[#667085] uppercase tracking-wider">
              Expired / Matured
            </span>
            <div className="text-2xl font-black font-mono text-slate-600 mt-2">
              {summary.expired_count}
            </div>
            <p className="text-[11px] text-[#667085] mt-1">
              Matured Without Closure
            </p>
          </div>
        </div>
      )}

      {/* Grid: Upcoming Watchlist & Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Watchlist */}
        <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs p-5 space-y-4">
          <h3 className="text-sm font-bold text-[#20242C] flex items-center justify-between">
            <span>Maturation Countdown Watchlist</span>
            <span className="text-[11px] font-mono text-[#667085]">Sorted by Urgency</span>
          </h3>

          <div className="space-y-2.5">
            {summary?.upcoming_30_days.concat(summary?.upcoming_90_days || []).map((f) => (
              <div
                key={f.fdr_id}
                className="p-3 bg-slate-50 rounded-xl border border-[#E4E7EC] flex items-center justify-between text-xs hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#20242C]">{f.receipt_number}</span>
                    <span className="text-[#667085]">&bull; {f.bank_name}</span>
                  </div>
                  <div className="text-[#667085] mt-1">
                    Principal: <strong className="text-[#20242C]">₹{f.principal_amount?.toLocaleString()}</strong> &rarr; Maturity:{' '}
                    <strong className="text-emerald-700">₹{f.maturity_amount?.toLocaleString()}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-md ${
                      f.days_remaining <= 7
                        ? 'bg-[#8B1E2D]/10 text-[#8B1E2D]'
                        : f.days_remaining <= 30
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {f.days_remaining} Days Left
                    </span>
                    <div className="text-[10px] text-[#667085] font-mono mt-0.5">{f.maturity_date}</div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedFdrForAction(f);
                      setNewPrincipal(f.principal_amount);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#20242C] font-semibold rounded-lg text-xs border border-[#E4E7EC] cursor-pointer"
                  >
                    Action
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Maturity Calendar Stream */}
        <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs p-5 space-y-4">
          <h3 className="text-sm font-bold text-[#20242C] flex items-center justify-between">
            <span>Maturity Calendar Timeline</span>
            <span className="text-[11px] font-mono text-[#667085]">2026 – 2027 Maturation</span>
          </h3>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {calendarEvents.map((evt, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-[#E4E7EC] text-xs"
              >
                <div className="min-w-[80px] text-center bg-white p-2 rounded-lg border border-[#E4E7EC] font-mono">
                  <span className="block text-[10px] text-[#667085] font-bold uppercase">
                    {new Date(evt.date).toLocaleString('default', { month: 'short' })}
                  </span>
                  <span className="block text-base font-black text-[#20242C]">
                    {new Date(evt.date).getDate()}
                  </span>
                  <span className="block text-[9px] text-[#667085]">
                    {new Date(evt.date).getFullYear()}
                  </span>
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{evt.receipt_number}</span>
                    <span className="font-mono font-bold text-emerald-700">₹{evt.maturity_amount?.toLocaleString()}</span>
                  </div>
                  <div className="text-slate-600 mt-1">{evt.bank_name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                    {evt.days_left >= 0 ? `${evt.days_left} days remaining` : 'Matured'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Renewal / Replacement Modal Dialog — Standardized Enterprise Box */}
      {selectedFdrForAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-[#E4E7EC] w-full max-w-[640px] lg:max-w-[680px] px-8 sm:px-12 md:px-14 py-7 sm:py-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">LIFECYCLE TRANSITION</span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 font-orbitron">
                  {selectedFdrForAction.receipt_number}
                </h3>
              </div>
              <button
                onClick={() => setSelectedFdrForAction(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold text-xl transition-colors cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">Action Type</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold focus:outline-hidden"
                >
                  <option value="RENEWED">Renew / Roll-Over Deposit</option>
                  <option value="REPLACED">Replace with New Certificate</option>
                  <option value="CLOSED">Matured &amp; Liquidated (Closed)</option>
                </select>
              </div>

              {actionType === 'RENEWED' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">New Maturity Date</label>
                    <input
                      type="date"
                      value={newMaturityDate}
                      onChange={(e) => setNewMaturityDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono text-xs focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">Rollover Principal Sum (₹)</label>
                    <input
                      type="number"
                      value={newPrincipal}
                      onChange={(e) => setNewPrincipal(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g. 1500000"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono text-xs focus:outline-hidden"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5 font-mono">Audit Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter branch authorization notes or transaction advice slip ID..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedFdrForAction(null)}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={handleExecuteAction}
                className="px-5 py-2.5 text-xs font-bold bg-[#8B1E2D] hover:bg-[#6F1724] text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Commit Lifecycle Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
