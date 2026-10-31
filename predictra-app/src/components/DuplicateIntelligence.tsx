import React, { useState, useEffect } from 'react';
import {
  fetchDuplicates,
  fetchDuplicateDetail,
  reviewDuplicate,
  type DuplicateMatchItem,
} from '../services/api';

export const DuplicateIntelligence: React.FC = () => {
  const [duplicates, setDuplicates] = useState<DuplicateMatchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadDuplicates = () => {
    setLoading(true);
    fetchDuplicates(levelFilter || undefined)
      .then((res) => setDuplicates(res.duplicates))
      .catch((err) => console.error('Failed loading duplicates:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDuplicates();
  }, [levelFilter]);

  const handleOpenDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const data = await fetchDuplicateDetail(id);
      setSelectedDetail(data);
    } catch (err) {
      alert('Failed loading duplicate details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReview = async (id: string, action: string) => {
    try {
      await reviewDuplicate(id, action);
      setSelectedDetail(null);
      loadDuplicates();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'LEVEL_1_EXACT_FILE':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'LEVEL_2_NEAR_DUPLICATE':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'LEVEL_3_FINANCIAL_RECORD':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {detailLoading && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            Loading duplicate details...
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs p-5 px-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="telemetry-pill bg-blue-50 text-blue-800 border border-blue-200">
                PHASE 5 DUPLICATE INTELLIGENCE
              </span>
              <span className="telemetry-pill bg-slate-100 text-[#667085] border border-[#E4E7EC]">
                MULTI-TIER DEDUPLICATION
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#20242C] tracking-tight">
              Duplicate &amp; Conflict Detection Engine
            </h1>
            <p className="text-xs text-[#667085] font-medium mt-1">
              Three-tier analytical detection: Level 1 (SHA-256 Exact), Level 2 (Perceptual dHash Layout), and Level 3 (Conflicting FDR References).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              aria-label="Filter Duplicates by Analysis Tier"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="text-xs font-mono bg-slate-50 border border-[#E4E7EC] rounded-xl px-3.5 py-2 text-[#20242C] font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="">All Tiers (Level 1, 2, 3)</option>
              <option value="LEVEL_1_EXACT_FILE">Level 1: Exact File (SHA-256)</option>
              <option value="LEVEL_2_NEAR_DUPLICATE">Level 2: Near-Duplicate (dHash)</option>
              <option value="LEVEL_3_FINANCIAL_RECORD">Level 3: Financial Record Conflict</option>
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-20 text-center text-[#667085] font-mono text-xs">
          Scanning cryptographic hashes and perceptual templates...
        </div>
      ) : duplicates.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E4E7EC] p-12 text-center text-[#667085]">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold text-lg mb-3">
            ✓
          </div>
          <h3 className="text-sm font-bold text-[#20242C] mt-2">Zero Duplicate Conflicts Detected</h3>
          <p className="text-xs text-[#667085] mt-1 max-w-md mx-auto">
            All FDR documents in the active repository possess unique cryptographic fingerprints and disjoint deposit references.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {duplicates.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs p-5 hover:border-slate-300 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-mono font-black px-2.5 py-1 rounded-md border ${getLevelBadge(d.match_level)}`}>
                    {d.match_level.replace(/_/g, ' ')}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-[#20242C] flex items-center gap-2">
                      <span className="font-mono text-[#8B1E2D]">{d.primary_ref}</span>
                      <span className="text-slate-400">&harr;</span>
                      <span className="font-mono text-[#20242C]">{d.duplicate_ref}</span>
                    </h3>
                    <p className="text-xs text-[#667085] mt-0.5">
                      {d.primary_bank} &bull; Similarity: <strong className="text-[#20242C] font-mono">{(d.similarity_score * 100).toFixed(1)}%</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-slate-100 text-[#667085] font-bold">
                    {d.status}
                  </span>
                  <button
                    onClick={() => handleOpenDetail(d.id)}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#20242C] font-semibold rounded-xl text-xs border border-[#E4E7EC] transition-colors cursor-pointer"
                  >
                    Side-by-Side Inspection
                  </button>
                </div>
              </div>

              <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-[#E4E7EC] text-xs">
                <p className="text-[#20242C] font-medium">{d.recommended_action}</p>
                {d.conflicting_fields && d.conflicting_fields.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold text-[#8B1E2D] uppercase">Conflicts:</span>
                    {d.conflicting_fields.map((cf, i) => (
                      <span key={i} className="text-[10px] font-mono bg-[#8B1E2D]/10 text-[#8B1E2D] border border-[#8B1E2D]/20 px-2 py-0.5 rounded-sm">
                        {cf}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Side-by-Side Comparison Modal — Standardized Enterprise Box */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-[#E4E7EC] w-full max-w-[640px] lg:max-w-[680px] px-8 sm:px-12 md:px-14 py-7 sm:py-8 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700">
                  {selectedDetail.match_level}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1 font-orbitron">
                  Side-by-Side Certificate Comparison
                </h3>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold text-xl transition-colors cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              {/* Primary Document Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Primary Record (First Upload)
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {selectedDetail.primary_fdr.receipt_number}
                </div>
                <div>Bank: {selectedDetail.primary_fdr.bank_name}</div>
                <div>Principal: ₹{selectedDetail.primary_fdr.principal_amount?.toLocaleString()}</div>
                <div>Maturity: ₹{selectedDetail.primary_fdr.maturity_amount?.toLocaleString()}</div>
                <div>Maturity Date: {selectedDetail.primary_fdr.maturity_date}</div>
              </div>

              {/* Duplicate Document Card */}
              <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-200 space-y-2">
                <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                  Suspected Duplicate / Conflict
                </div>
                <div className="text-sm font-bold text-rose-900">
                  {selectedDetail.duplicate_fdr.receipt_number}
                </div>
                <div>Bank: {selectedDetail.duplicate_fdr.bank_name}</div>
                <div>Principal: ₹{selectedDetail.duplicate_fdr.principal_amount?.toLocaleString()}</div>
                <div>Maturity: ₹{selectedDetail.duplicate_fdr.maturity_amount?.toLocaleString()}</div>
                <div>Maturity Date: {selectedDetail.duplicate_fdr.maturity_date}</div>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              <strong>Recommended Action:</strong> {selectedDetail.recommended_action}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedDetail(null)}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handleReview(selectedDetail.id, 'FALSE_POSITIVE')}
                className="px-5 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-300 transition-colors cursor-pointer"
              >
                Mark False Positive
              </button>
              <button
                onClick={() => handleReview(selectedDetail.id, 'CONFIRMED_DUPLICATE')}
                className="px-5 py-2.5 text-xs font-bold bg-[#8B1E2D] hover:bg-[#6F1724] text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Confirm Duplicate Violation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
