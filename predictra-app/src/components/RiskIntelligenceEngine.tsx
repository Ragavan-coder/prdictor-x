import React, { useState, useEffect } from 'react';
import {
  fetchFDRTableRecords,
  fetchRiskAssessment,
  type RiskAssessmentResponse,
  type FDRRecordModelItem,
} from '../services/api';

export const RiskIntelligenceEngine: React.FC = () => {
  const [fdrs, setFdrs] = useState<FDRRecordModelItem[]>([]);
  const [currentFdrId, setCurrentFdrId] = useState<string | null>(null);
  const [risk, setRisk] = useState<RiskAssessmentResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFDRTableRecords({ pageSize: 50 })
      .then((res) => {
        setFdrs(res.records);
        if (res.records.length > 0) {
          setCurrentFdrId(res.records[0].id);
        }
      })
      .catch((err) => console.error('Failed fetching FDRs for risk engine:', err));
  }, []);

  useEffect(() => {
    if (!currentFdrId) return;
    setLoading(true);
    fetchRiskAssessment(currentFdrId)
      .then((res) => setRisk(res))
      .catch((err) => console.error('Failed fetching risk:', err))
      .finally(() => setLoading(false));
  }, [currentFdrId]);

  const getClassificationBadge = (cls: string) => {
    switch (cls) {
      case 'VERIFIED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'VERIFIED_WITH_WARNINGS':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'SUSPICIOUS':
      case 'PROCESSING_FAILED':
        return 'bg-[#8B1E2D]/10 text-[#8B1E2D] border-[#8B1E2D]/30';
      default:
        return 'bg-blue-50 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Masthead Header */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs p-5 px-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="telemetry-pill bg-[#8B1E2D]/10 text-[#8B1E2D] border border-[#8B1E2D]/20">
                PHASE 4 RISK INTELLIGENCE
              </span>
              <span className="telemetry-pill bg-slate-100 text-[#667085] border border-[#E4E7EC]">
                TRANSPARENT FACTOR SCORING
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#20242C] tracking-tight flex items-center gap-2.5">
              <span>Risk Intelligence & Decision Engine</span>
            </h1>
            <p className="text-xs text-[#667085] font-medium mt-1">
              Deterministic multi-factor risk quantification without arbitrary uncalibrated probabilities.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              aria-label="Select FDR Certificate to Assess"
              value={currentFdrId || ''}
              onChange={(e) => setCurrentFdrId(e.target.value)}
              className="text-xs font-mono bg-slate-50 border border-[#E4E7EC] rounded-xl px-3.5 py-2 text-[#20242C] font-semibold focus:outline-none focus:border-[#8B1E2D] cursor-pointer shadow-2xs"
            >
              {fdrs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.receipt_number} &bull; {f.bank_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-[#667085] font-mono text-xs">
          Computing multi-dimensional risk matrix...
        </div>
      ) : risk ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Column 1: Composite Decision & Score */}
          <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs p-6 space-y-5 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-mono font-bold text-[#667085] uppercase tracking-wider">
                Formal Classification
              </span>
              <div className="mt-2">
                <span className={`text-xs font-bold font-mono px-3 py-1.5 rounded-lg border ${getClassificationBadge(risk.classification)}`}>
                  {risk.classification}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-[#667085] uppercase tracking-wider">
                  Composite Risk Score
                </span>
                <span className="text-xs font-mono font-bold text-[#8B1E2D]">
                  {risk.severity} SEVERITY
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-black font-mono text-[#20242C]">
                  {risk.composite_risk_score}
                </span>
                <span className="text-xs text-[#667085] font-mono">/ 100</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2 overflow-hidden">
                <div
                  className={`h-full ${risk.composite_risk_score < 30 ? 'bg-emerald-500' : risk.composite_risk_score < 60 ? 'bg-amber-500' : 'bg-[#8B1E2D]'}`}
                  style={{ width: `${Math.max(5, risk.composite_risk_score)}%` }}
                />
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-[#E4E7EC] text-xs text-[#20242C] leading-relaxed">
              <strong>Decision Rationale:</strong>
              <p className="mt-1 text-[#667085]">{risk.decision_explanation}</p>
            </div>

            <div className="pt-2 text-xs font-mono space-y-1.5 text-[#667085] border-t border-[#E4E7EC]">
              <div>Total Verification Findings: <strong className="text-[#20242C]">{risk.total_findings_count}</strong></div>
              <div>Flagged Anomalies: <strong className="text-[#20242C]">{risk.total_anomalies_count}</strong></div>
              <div>Duplicate Conflicts: <strong className="text-[#20242C]">{risk.total_duplicates_count}</strong></div>
            </div>
          </div>

          {/* Column 2 & 3: Transparent Factor Breakdown & Active Indicators */}
          <div className="lg:col-span-2 space-y-6">
            {/* Factor Scores */}
            <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs p-6 space-y-4">
              <h3 className="text-sm font-bold text-[#20242C] flex items-center gap-2">
                <span>Transparent Factor Weights Breakdown</span>
              </h3>
              <p className="text-xs text-[#667085]">
                Individual risk contributions capped at 40 points each to prevent single-factor skew.
              </p>

              <div className="space-y-3 pt-2">
                {Object.entries(risk.factor_scores).map(([k, val]) => (
                  <div key={k} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#20242C] font-mono">
                        {k.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="font-mono text-[#20242C] font-bold">
                        {val.toFixed(1)} / 40.0
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${val > 20 ? 'bg-[#8B1E2D]' : val > 5 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${(val / 40.0) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Indicators */}
            <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs p-6 space-y-3">
              <h3 className="text-sm font-bold text-[#20242C] flex items-center gap-2">
                <span>Triggered Risk Indicators</span>
              </h3>

              {risk.risk_indicators.length === 0 ? (
                <p className="text-xs text-emerald-700 font-medium bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  Zero active risk triggers. Deposit receipt passes all institutional risk rules.
                </p>
              ) : (
                <div className="space-y-2">
                  {risk.risk_indicators.map((ind, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-[#E4E7EC] text-xs">
                      <span className="text-[#8B1E2D] font-bold">&bull;</span>
                      <span className="font-semibold text-[#20242C]">{ind}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
