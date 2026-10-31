import { useEffect, useState } from 'react';
import {
  fetchDashboardSummary,
  type DashboardSummaryResponse,
  downloadAuditPdf,
} from '../services/api';
import type { NavigationTab } from './Sidebar';

interface DashboardProps {
  onNavigate: (tab: NavigationTab) => void;
  onSelectFDR?: (fdrId: string) => void;
}

export default function FDRManagementDashboard({ onNavigate, onSelectFDR }: DashboardProps) {
  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetchDashboardSummary();
        if (mounted) {
          setData(res);
          setError(null);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch dashboard metrics.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      await downloadAuditPdf();
    } catch (err) {
      console.error(err);
      alert('Failed to generate audit PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  const overview = data?.overview || {
    total_fdr_records: 0,
    total_principal_amount: 0,
    successfully_processed_documents: 0,
    pending_verification: 0,
    flagged_anomalies: 0,
    upcoming_maturity_count: 0,
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* 1. Masthead Header & Quick Action Suite */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs p-5 px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="telemetry-pill bg-emerald-50 text-emerald-800 border border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              POSTGRESQL LIVE STORE
            </span>
            <span className="telemetry-pill bg-cyan-50 text-cyan-800 border border-cyan-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              KEYCLOAK RBAC ACTIVE
            </span>
            <span className="telemetry-pill bg-slate-100 text-[#667085] border border-[#E4E7EC]">
              SENTRA 4-LAYER CORE
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-[#20242C] tracking-tight">
            FDR Management &amp; Forensic Intelligence
          </h2>
          <p className="text-[#667085] font-medium mt-1 text-xs sm:text-sm">
            Universal Reading Engine • Multi-layer Verification • Continuous Risk Monitoring
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => onNavigate('upload')}
            className="px-5 py-2.5 rounded-xl bg-[#8B1E2D] hover:bg-[#6F1724] text-white font-semibold shadow-2xs flex items-center gap-2 transition-all cursor-pointer text-xs sm:text-sm"
          >
            <span>Upload New FDR</span>
          </button>

          <button
            onClick={() => onNavigate('records')}
            className="px-5 py-2.5 rounded-xl bg-white border border-[#E4E7EC] hover:bg-slate-50 text-[#20242C] font-semibold shadow-2xs flex items-center gap-2 transition-all cursor-pointer text-xs sm:text-sm"
          >
            <span>View All FDRs</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="px-5 py-2.5 rounded-xl bg-[#20242C] hover:bg-neutral-800 text-white font-semibold shadow-2xs flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer text-xs sm:text-sm"
          >
            <span>{exportingPdf ? 'Exporting...' : 'Signed Audit Dossier'}</span>
          </button>
        </div>
      </div>

      {/* Loading or Error State */}
      {loading && (
        <div className="p-14 text-center panel-box">
          <div className="inline-block w-10 h-10 border-3 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-semibold text-slate-700 font-mono" style={{ fontSize: '0.85rem' }}>
            Synchronizing telemetry with PostgreSQL database...
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 flex items-center justify-between shadow-xs gap-4" style={{ fontSize: '0.85rem' }}>
          <span className="flex items-center gap-2">
            <span>⚠️</span>
            <strong>Database synchronization error:</strong> {error}
          </span>
          <button
            onClick={() => window.location.reload()}
            className="px-3.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold transition-colors flex-shrink-0"
            style={{ fontSize: '0.82rem' }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* 2. Overview KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* 1. Total FDRs */}
            <div className="stat-card group">
              <div className="h-1.5 w-full absolute top-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-600" />
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#667085] uppercase tracking-wider text-[11px]">
                  Total Records
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">FDR</span>
              </div>
              <div className="mt-3">
                <p className="font-black text-[#20242C] font-orbitron tracking-tight text-xl sm:text-2xl">
                  {overview.total_fdr_records}
                </p>
                <p className="text-[#667085] font-medium mt-1 flex items-center gap-1 font-mono text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  PostgreSQL Verified
                </p>
              </div>
            </div>

            {/* 2. Total Principal */}
            <div className="stat-card group">
              <div className="h-1.5 w-full absolute top-0 left-0 bg-gradient-to-r from-slate-700 to-slate-900" />
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#667085] uppercase tracking-wider text-[11px]">
                  Principal Sum
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-[#20242C] border border-[#E4E7EC]">INR</span>
              </div>
              <div className="mt-3">
                <p
                  className="font-black text-[#20242C] font-mono tracking-tight truncate text-base sm:text-lg"
                  title={formatCurrency(overview.total_principal_amount)}
                >
                  {formatCurrency(overview.total_principal_amount)}
                </p>
                <p className="text-[#667085] font-medium mt-1 flex items-center gap-1 font-mono text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  Cumulative Active
                </p>
              </div>
            </div>

            {/* 3. Extracted Documents */}
            <div className="stat-card group">
              <div className="h-1.5 w-full absolute top-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-600" />
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#667085] uppercase tracking-wider text-[11px]">
                  Extracted Docs
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">DOC</span>
              </div>
              <div className="mt-3">
                <p className="font-black text-emerald-600 font-orbitron tracking-tight text-xl sm:text-2xl">
                  {overview.successfully_processed_documents}
                </p>
                <p className="text-emerald-700 font-medium mt-1 flex items-center gap-1 font-mono text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Universal OCR
                </p>
              </div>
            </div>

            {/* 4. Pending Verification */}
            <div className="stat-card group">
              <div className="h-1.5 w-full absolute top-0 left-0 bg-gradient-to-r from-amber-500 to-orange-500" />
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#667085] uppercase tracking-wider text-[11px]">
                  Pending Review
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">REV</span>
              </div>
              <div className="mt-3">
                <p className="font-black text-amber-600 font-orbitron tracking-tight text-xl sm:text-2xl">
                  {overview.pending_verification}
                </p>
                <p className="text-amber-700 font-medium mt-1 flex items-center gap-1 font-mono text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Review Queue
                </p>
              </div>
            </div>

            {/* 5. Flagged Anomalies */}
            <div className="stat-card group">
              <div className="h-1.5 w-full absolute top-0 left-0 bg-gradient-to-r from-[#8B1E2D] to-red-600" />
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#667085] uppercase tracking-wider text-[11px]">
                  Anomalies
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-rose-50 text-[#8B1E2D] border border-rose-200">FLAG</span>
              </div>
              <div className="mt-3">
                <p className="font-black text-[#8B1E2D] font-orbitron tracking-tight text-xl sm:text-2xl">
                  {overview.flagged_anomalies}
                </p>
                <p className="text-[#8B1E2D] font-medium mt-1 flex items-center gap-1 font-mono text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8B1E2D]" />
                  Discrepancies
                </p>
              </div>
            </div>

            {/* 6. Upcoming Maturity */}
            <div className="stat-card group">
              <div className="h-1.5 w-full absolute top-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-600" />
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#667085] uppercase tracking-wider text-[11px]">
                  Upcoming
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">DUE</span>
              </div>
              <div className="mt-3">
                <p className="font-black text-indigo-600 font-orbitron tracking-tight text-xl sm:text-2xl">
                  {overview.upcoming_maturity_count}
                </p>
                <p className="text-indigo-700 font-medium mt-1 flex items-center gap-1 font-mono text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Due &lt; 12 Mos
                </p>
              </div>
            </div>
          </div>

          {/* 3. Section: Upcoming Maturity & Recent Activity in Balanced Flexible Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Left Box: Upcoming Maturity Watchlist */}
            <div className="panel-box h-[520px] flex flex-col">
              <div className="flex-1 flex flex-col min-h-0">
                <div className="panel-box-header">
                  <div>
                    <h3 className="font-bold text-[#20242C] text-sm sm:text-base">
                      Upcoming Maturity Watchlist
                    </h3>
                    <p className="text-[#667085] font-mono text-xs mt-0.5">
                      Lifecycle tracking &amp; renewal alerts
                    </p>
                  </div>
                  <button
                    onClick={() => onNavigate('records')}
                    className="text-[#8B1E2D] hover:text-[#6F1724] font-semibold text-xs flex items-center gap-1 transition-colors flex-shrink-0 cursor-pointer"
                  >
                    View All →
                  </button>
                </div>

                <div className="p-4 space-y-2.5 flex-1 overflow-y-auto">
                  {data?.upcoming_maturities && data.upcoming_maturities.length > 0 ? (
                    data.upcoming_maturities.map((item) => {
                      const isUrgent = item.days_remaining <= 120;
                      const isMedium = item.days_remaining > 120 && item.days_remaining <= 250;
                      const fdrDisplay = item.fdr_number && !item.fdr_number.toLowerCase().startsWith('branch')
                        ? item.fdr_number
                        : `FDR-REF-${item.id ? item.id.substring(0, 8).toUpperCase() : 'REC'}`;

                      return (
                        <div
                          key={item.id}
                          onClick={() => onSelectFDR?.(item.id)}
                          className="panel-box-row flex items-center justify-between cursor-pointer group"
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-[#20242C] group-hover:text-[#8B1E2D] transition-colors text-xs sm:text-sm">
                                {fdrDisplay}
                              </span>
                              <span className="font-semibold px-2 py-0.5 rounded-md bg-white border border-[#E4E7EC] text-[#20242C] shadow-2xs text-[11px]">
                                {item.bank_name || 'Bank Partner'}
                              </span>
                            </div>
                            <p className="text-[#667085] mt-1 font-mono text-xs">
                              Principal: <span className="font-semibold text-[#20242C]">{formatCurrency(item.principal_amount)}</span> → Maturity:{' '}
                              <strong className="text-[#20242C] font-bold">{formatCurrency(item.maturity_amount)}</strong>
                            </p>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg font-bold font-mono shadow-2xs border text-xs ${
                                isUrgent
                                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                                  : isMedium
                                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              }`}
                            >
                              {item.days_remaining} Days Left
                            </span>
                            <p className="text-[#667085] font-mono mt-1 font-semibold text-[11px]">
                              Due {item.maturity_date}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-[#667085] text-xs">
                      No upcoming maturities recorded in the active ledger.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Box: Recent Document & Verification Activity */}
            <div className="panel-box h-[520px] flex flex-col">
              <div className="flex-1 flex flex-col min-h-0">
                <div className="panel-box-header">
                  <div>
                    <h3 className="font-bold text-[#20242C] text-sm sm:text-base">
                      Recent Document &amp; Verification Activity
                    </h3>
                    <p className="text-[#667085] font-mono text-xs mt-0.5">
                      Real-time audit chain events
                    </p>
                  </div>
                  <button
                    onClick={() => onNavigate('audit')}
                    className="text-[#8B1E2D] hover:text-[#6F1724] font-semibold text-xs flex items-center gap-1 transition-colors flex-shrink-0 cursor-pointer"
                  >
                    Audit Trail →
                  </button>
                </div>

                <div className="p-4 space-y-2.5 flex-1 overflow-y-auto">
                  {data?.recent_activity && data.recent_activity.length > 0 ? (
                    data.recent_activity.map((act) => {
                      const isSuccess = act.status === 'COMPLETED' || act.status === 'SUCCESS';
                      const isFailure = act.status === 'FAILED' || act.status === 'ERROR';

                      return (
                        <div
                          key={act.id}
                          className="panel-box-row flex items-start gap-3"
                        >
                          <div className="mt-1.5 flex-shrink-0">
                            {isSuccess ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-sm shadow-emerald-500/50" />
                            ) : isFailure ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-[#8B1E2D] inline-block shadow-sm shadow-[#8B1E2D]/50" />
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-sm shadow-amber-500/50" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-bold text-[#20242C] truncate text-xs sm:text-sm">
                                {act.title}
                              </p>
                              <span className="font-mono text-[#667085] whitespace-nowrap font-semibold text-[11px]">
                                {act.timestamp}
                              </span>
                            </div>
                            <p className="text-[#667085] mt-0.5 line-clamp-1 font-mono text-xs">
                              {act.description}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-[#667085] text-xs">
                      No recent operational events recorded.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
