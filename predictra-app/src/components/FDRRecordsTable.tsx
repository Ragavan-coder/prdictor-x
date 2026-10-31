import React, { useState, useEffect } from 'react';
import {
  fetchFDRTableRecords,
  type FDRTableRecord,
} from '../services/api';
import type { NavigationTab } from './Sidebar';

interface Props {
  onNavigate: (tab: NavigationTab) => void;
  onInspectDocument?: (documentId: string) => void;
}

export default function FDRRecordsTable({ onNavigate, onInspectDocument }: Props) {
  const [records, setRecords] = useState<FDRTableRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('maturity_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<FDRTableRecord | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchFDRTableRecords({
        page,
        pageSize,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        sortBy,
        sortOrder,
      });
      setRecords(res.records);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed fetching FDR records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, statusFilter, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 px-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="telemetry-pill bg-slate-100 text-slate-700 border border-slate-200">
              REPOSITORY LEDGER
            </span>
            <span className="telemetry-pill bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              {total} Total Records
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 font-orbitron tracking-tight">
            Fixed Deposit Records Repository
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Search, filter, inspect 4-layer evidence and verify Indian bank certificates
          </p>
        </div>

        <button
          onClick={() => onNavigate('upload')}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B1E2D] via-[#A00D24] to-[#6F1724] hover:from-[#6F1724] hover:to-[#55101B] text-white text-xs font-bold shadow-sm shadow-[#8B1E2D]/20 flex items-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
        >
          <span>📤</span>
          <span>Upload Document</span>
        </button>
      </div>

      {/* 2. Filter and Search Bar */}
      <div className="bg-white p-4 px-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="w-full md:w-96 flex items-center gap-2">
          <div className="relative w-full">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search FDR number, bank, or holder..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all font-medium"
            />
            <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
          >
            Search
          </button>
        </form>

        {/* Filter Dropdowns */}
        <div className="w-full md:w-auto flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 font-mono">STATUS:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 text-slate-800 font-semibold focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="VERIFIED_AUTHENTIC">Verified Authentic</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="FLAGGED_ANOMALY">Flagged Anomaly</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 font-mono">SORT:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 text-slate-800 font-semibold focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="maturity_date">Maturity Date</option>
              <option value="principal_amount">Principal Amount</option>
              <option value="bank_name">Bank Name</option>
              <option value="issue_date">Issue Date</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 bg-slate-50/50 hover:bg-slate-100 transition-all"
              title="Toggle sort direction"
            >
              {sortOrder === 'asc' ? '▲ ASC' : '▼ DESC'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                <th className="py-3 px-4">FDR Ref #</th>
                <th className="py-3 px-4">Bank & Branch</th>
                <th className="py-3 px-4">Principal Sum</th>
                <th className="py-3 px-4">Interest & Term</th>
                <th className="py-3 px-4">Maturity Value</th>
                <th className="py-3 px-4">Maturity Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="inline-block w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="font-medium text-xs">Querying database records...</p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <p className="text-base mb-1">📑</p>
                    <p className="font-semibold text-slate-700">No FDR records found matching criteria.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Try resetting search filters or upload a new FDR.</p>
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const isVerified = r.verification_status === 'VERIFIED_AUTHENTIC';
                  const isAnomaly = r.verification_status === 'FLAGGED_ANOMALY';
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {r.receipt_number}
                        {r.account_holder && (
                          <div className="text-[10px] font-normal text-slate-500 font-sans">
                            {r.account_holder}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900 block">{r.bank_name}</span>
                        <span className="text-[10px] text-slate-500">{r.branch_name || 'Main Branch'}</span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {formatCurrency(r.principal_amount)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800">{r.interest_rate}%</span>
                        <span className="text-[10px] text-slate-500 block">({r.tenure_months}m / {r.compounding_frequency})</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {formatCurrency(r.maturity_amount)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {r.maturity_date}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border ${
                            isVerified
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isAnomaly
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isVerified ? 'VERIFIED' : isAnomaly ? 'ANOMALY' : 'PENDING'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedRecord(r)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-all"
                          >
                            Details
                          </button>
                          {r.document_id && onInspectDocument && (
                            <button
                              onClick={() => onInspectDocument(r.document_id!)}
                              className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-semibold transition-all"
                              title="Inspect Universal Reading OCR Evidence"
                            >
                              Evidence →
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="py-3 px-4 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong>{records.length}</strong> of <strong>{total}</strong> FDR records
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40 text-xs font-medium hover:bg-slate-50"
            >
              Previous
            </button>
            <span className="font-mono text-xs font-semibold text-slate-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 disabled:opacity-40 text-xs font-medium hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Detail Inspection Modal — Standardized Enterprise Box */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-[#E4E7EC] shadow-2xl w-full max-w-[640px] lg:max-w-[680px] overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 bg-slate-50 border-b border-[#E4E7EC] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#8B1E2D] bg-[#8B1E2D]/10 px-2 py-0.5 rounded">
                  FDR VERIFICATION AUDIT
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 font-orbitron mt-1">
                  {selectedRecord.receipt_number}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="px-6 sm:px-8 py-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 font-medium">Bank:</span>
                  <p className="font-bold text-slate-900">{selectedRecord.bank_name}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">IFSC:</span>
                  <p className="font-mono font-bold text-slate-900">{selectedRecord.ifsc_code || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Principal Deposit:</span>
                  <p className="font-bold text-slate-900">{formatCurrency(selectedRecord.principal_amount)}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Maturity Sum:</span>
                  <p className="font-bold text-slate-900">{formatCurrency(selectedRecord.maturity_amount)}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Issue Date:</span>
                  <p className="font-mono text-slate-800">{selectedRecord.issue_date}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Maturity Date:</span>
                  <p className="font-mono text-slate-800">{selectedRecord.maturity_date}</p>
                </div>
              </div>

              {/* Four Layer Status */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs mb-2">
                  SENTRA 4-Layer Verification Breakdown:
                </h4>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">L1:</span>
                    <span className="text-slate-700">{selectedRecord.layer1_evidence}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">L2:</span>
                    <span className="text-slate-700">{selectedRecord.layer2_calculations}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">L3:</span>
                    <span className="text-slate-700">{selectedRecord.layer3_bank_validation}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">L4:</span>
                    <span className="text-slate-700">{selectedRecord.layer4_doubtful_digits}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-[#E4E7EC] flex justify-end gap-2.5">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
              {selectedRecord.document_id && onInspectDocument && (
                <button
                  onClick={() => {
                    const docId = selectedRecord.document_id!;
                    setSelectedRecord(null);
                    onInspectDocument(docId);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#8B1E2D] hover:bg-[#6F1724] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Inspect Universal Reading
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
