import React, { useState, useEffect } from 'react';
import {
  fetchFDRTableRecords,
  fetchSentraResults,
  runSentraVerification,
  fetchRepairProposals,
  reviewRepairProposal,
  downloadInvestigationPDF,
  downloadInvestigationExcel,
  getDocumentPreviewUrl,
  type VerificationResultsResponse,
  type AutoRepairProposalItem,
  type FDRRecordModelItem,
} from '../services/api';

interface Props {
  selectedFdrId?: string;
}

export const SentraVerificationCenter: React.FC<Props> = ({ selectedFdrId }) => {
  const [fdrs, setFdrs] = useState<FDRRecordModelItem[]>([]);
  const [currentFdrId, setCurrentFdrId] = useState<string | null>(selectedFdrId || null);
  const [verification, setVerification] = useState<VerificationResultsResponse | null>(null);
  const [proposals, setProposals] = useState<AutoRepairProposalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [activeLayer, setActiveLayer] = useState<1 | 2 | 3 | 4>(1);
  const [downloading, setDownloading] = useState<'pdf' | 'excel' | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Load FDR records
  useEffect(() => {
    fetchFDRTableRecords({ pageSize: 50 })
      .then((res) => {
        setFdrs(res.records);
        if (!currentFdrId && res.records.length > 0) {
          setCurrentFdrId(res.records[0].id);
        }
      })
      .catch((err) => console.error('Failed loading FDRs:', err));
  }, []);

  // Load verification results and auto-repair proposals when current FDR changes
  useEffect(() => {
    if (!currentFdrId) return;
    setLoading(true);
    setActionMsg(null);

    Promise.all([
      fetchSentraResults(currentFdrId),
      fetchRepairProposals(currentFdrId),
    ])
      .then(([vRes, pRes]) => {
        setVerification(vRes);
        setProposals(pRes.proposals || []);
      })
      .catch((err) => {
        console.error('Failed fetching verification:', err);
      })
      .finally(() => setLoading(false));
  }, [currentFdrId]);

  const handleRunVerification = async () => {
    if (!currentFdrId) return;
    setVerifying(true);
    setActionMsg(null);
    try {
      await runSentraVerification(currentFdrId);
      const [vRes, pRes] = await Promise.all([
        fetchSentraResults(currentFdrId),
        fetchRepairProposals(currentFdrId),
      ]);
      setVerification(vRes);
      setProposals(pRes.proposals || []);
      setActionMsg('SENTRA 4-Layer Verification successfully executed and recorded to audit trail!');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleReviewProposal = async (proposalId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      await reviewRepairProposal(proposalId, action, `Reviewed by compliance officer via SENTRA Verification Center`);
      if (currentFdrId) {
        const pRes = await fetchRepairProposals(currentFdrId);
        setProposals(pRes.proposals || []);
        setActionMsg(`Proposal ${action === 'APPROVE' ? 'approved and ledger updated' : 'rejected'}.`);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleDownloadPDF = async () => {
    if (!verification) return;
    setDownloading('pdf');
    try {
      await downloadInvestigationPDF(verification.fdr_id, verification.receipt_number);
    } catch (err) {
      alert('Failed generating PDF investigation report');
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadExcel = async () => {
    if (!verification) return;
    setDownloading('excel');
    try {
      await downloadInvestigationExcel(verification.fdr_id, verification.receipt_number);
    } catch (err) {
      alert('Failed generating Excel audit workbook');
    } finally {
      setDownloading(null);
    }
  };

  const currentFdr = fdrs.find((f) => f.id === currentFdrId) || fdrs[0];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'VERIFIED_WITH_WARNINGS':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'SUSPICIOUS':
      case 'FAILED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getRiskMeterColor = (score: number) => {
    if (score < 25) return 'bg-emerald-500';
    if (score < 50) return 'bg-amber-500';
    return 'bg-rose-600';
  };

  const findings = verification?.findings_by_layer?.[activeLayer] || [];

  return (
    <div className="space-y-6">
      {/* 1. Masthead Header Bar */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs p-5 px-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="telemetry-pill bg-[#8B1E2D]/10 text-[#8B1E2D] border border-[#8B1E2D]/20">
                SENTRA FOUR-LAYER VERIFICATION
              </span>
              <span className="telemetry-pill bg-slate-100 text-[#667085] border border-[#E4E7EC]">
                ALGORITHMIC FORENSIC AUDIT
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#20242C] tracking-tight">
              SENTRA Verification Center
            </h1>
            <p className="text-xs text-[#667085] font-medium mt-1">
              Independent multi-layer validation engine: Page Evidence, Financial Math, Bank Confirmation, and Digit Uncertainty.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* FDR Selector */}
            <select
              aria-label="Select FDR Record to Inspect"
              value={currentFdrId || ''}
              onChange={(e) => setCurrentFdrId(e.target.value)}
              className="text-xs font-mono bg-slate-50 border border-[#E4E7EC] rounded-xl px-3.5 py-2 text-[#20242C] font-semibold focus:outline-hidden focus:border-[#8B1E2D] cursor-pointer shadow-2xs"
            >
              {fdrs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.receipt_number} — {f.bank_name} (₹{f.principal_amount.toLocaleString()})
                </option>
              ))}
            </select>

            <button
              onClick={handleRunVerification}
              disabled={verifying}
              className="px-4 py-2 bg-[#8B1E2D] hover:bg-[#6F1724] text-white text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
            >
              {verifying && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <span>{verifying ? 'Verifying...' : 'Re-Run Verification'}</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={downloading === 'pdf' || !verification}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-[#20242C] text-xs font-semibold rounded-xl border border-[#E4E7EC] shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>{downloading === 'pdf' ? 'Exporting...' : 'PDF Dossier'}</span>
            </button>

            <button
              onClick={handleDownloadExcel}
              disabled={downloading === 'excel' || !verification}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-[#20242C] text-xs font-semibold rounded-xl border border-[#E4E7EC] shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>{downloading === 'excel' ? 'Exporting...' : 'Excel Audit'}</span>
            </button>
          </div>
        </div>

        {actionMsg && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
            <span className="font-bold">✓</span> {actionMsg}
          </div>
        )}
      </div>

      {/* 2. Overview Metric Cards & Score Meter */}
      {verification && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Decision */}
          <div className="bg-white rounded-xl border border-[#E4E7EC] p-4.5 shadow-2xs flex flex-col justify-between relative overflow-hidden">
            <span className="text-[11px] font-mono font-bold text-[#667085] uppercase tracking-wider">
              Verification Decision
            </span>
            <div className="mt-2.5 flex items-center gap-2">
              <span className={`text-xs font-black font-mono px-3 py-1.5 rounded-lg border shadow-2xs ${getStatusBadge(verification.overall_status)}`}>
                {verification.overall_status}
              </span>
            </div>
            <p className="text-[11px] text-[#667085] mt-3 font-mono">
              Bank Confirmation: <strong className="text-[#20242C]">{verification.bank_confirmation_status}</strong>
            </p>
          </div>

          {/* Card 2: Risk Score Meter */}
          <div className="bg-white rounded-xl border border-[#E4E7EC] p-4.5 shadow-2xs flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-[#667085] uppercase tracking-wider">
                Composite Risk Score
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-[#667085] border border-[#E4E7EC]">
                {verification.risk_severity}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-[#20242C]">
                {verification.risk_score}
              </span>
              <span className="text-xs text-[#667085] font-mono">/ 100</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className={`h-full ${getRiskMeterColor(verification.risk_score)} transition-all duration-500`}
                style={{ width: `${Math.max(5, verification.risk_score)}%` }}
              />
            </div>
          </div>

          {/* Card 3: Financial Details */}
          <div className="bg-white rounded-xl border border-[#E4E7EC] p-4.5 shadow-2xs flex flex-col justify-between relative overflow-hidden">
            <span className="text-[11px] font-mono font-bold text-[#667085] uppercase tracking-wider">
              Principal Deposit
            </span>
            <div className="mt-2 text-xl font-black font-mono text-[#20242C]">
              ₹{verification.principal_amount?.toLocaleString()}
            </div>
            <p className="text-[11px] text-[#667085] mt-2 font-mono">
              Maturity: <strong className="text-[#20242C]">₹{verification.maturity_amount?.toLocaleString()}</strong>
            </p>
          </div>

          {/* Card 4: Issuing Institution */}
          <div className="bg-white rounded-xl border border-[#E4E7EC] p-4.5 shadow-2xs flex flex-col justify-between relative overflow-hidden">
            <span className="text-[11px] font-mono font-bold text-[#667085] uppercase tracking-wider">
              Issuing Bank &amp; Branch
            </span>
            <div className="mt-2 text-sm font-bold text-[#20242C] truncate">
              {verification.bank_name}
            </div>
            <p className="text-[11px] text-[#667085] mt-2 truncate font-mono">
              Ref: <span className="font-semibold text-[#20242C]">{verification.receipt_number}</span>
            </p>
          </div>
        </div>
      )}

      {/* Auto-Repair Proposal Banner (Phase 3) */}
      {proposals.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 shadow-2xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div>
                <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <span>SENTRA Auto-Repair Proposal</span>
                  <span className="text-[10px] font-mono bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-extrabold">
                    {proposals.filter((p) => p.status === 'PENDING').length} PENDING AUDITOR APPROVAL
                  </span>
                </h3>
                <p className="text-xs text-amber-800 mt-1">
                  Evidence-grounded reconciliation detected ambiguous OCR readings with clear compound interest corroboration:
                </p>
                <div className="mt-3 space-y-2">
                  {proposals.map((p) => (
                    <div key={p.id} className="bg-white/80 p-3 rounded-lg border border-amber-200 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <strong className="text-[#20242C]">{p.field_label}:</strong>{' '}
                          <span className="font-mono line-through text-rose-600 font-bold">{p.original_value}</span>{' '}
                          &rarr;{' '}
                          <span className="font-mono text-emerald-700 font-black text-sm">{p.proposed_value}</span>
                          <span className="text-[10px] text-[#667085] ml-2 font-mono">({p.model_method})</span>
                        </div>
                        {p.status === 'PENDING' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleReviewProposal(p.id, 'APPROVE')}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs shadow-2xs cursor-pointer"
                            >
                              Approve Correction
                            </button>
                            <button
                              onClick={() => handleReviewProposal(p.id, 'REJECT')}
                              className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-[#20242C] font-semibold rounded-lg text-xs cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-slate-200 text-[#667085]">
                            {p.status} by {p.reviewed_by || 'Auditor'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#667085] mt-1 italic">{p.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Four-Layer Navigation Tabs */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs overflow-hidden">
        <div className="flex border-b border-[#E4E7EC] bg-slate-50 overflow-x-auto">
          {[
            { id: 1, name: 'Layer 1: Page Evidence', badge: verification?.layer_statuses?.layer1 },
            { id: 2, name: 'Layer 2: Financial Math', badge: verification?.layer_statuses?.layer2 },
            { id: 3, name: 'Layer 3: Bank & QR', badge: verification?.layer_statuses?.layer3 },
            { id: 4, name: 'Layer 4: Doubtful Digits', badge: verification?.layer_statuses?.layer4 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveLayer(tab.id as any)}
              className={`flex-1 min-w-[200px] px-5 py-4 text-xs font-bold flex items-center justify-between border-b-2 transition-all cursor-pointer ${
                activeLayer === tab.id
                  ? 'border-[#8B1E2D] bg-white text-[#20242C] shadow-2xs'
                  : 'border-transparent text-[#667085] hover:text-[#20242C] hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{tab.name}</span>
              </div>
              {tab.badge && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-sm font-extrabold ${
                  tab.badge === 'PASSED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="p-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400 font-mono text-sm">
              Loading SENTRA 4-Layer analysis telemetry...
            </div>
          ) : (
            <div>
              {/* Layer 1: Page Evidence */}
              {activeLayer === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#20242C] flex items-center gap-2">
                        <span>Computer Vision &amp; Physical Document Analysis</span>
                      </h3>
                      <p className="text-xs text-[#667085] mt-0.5">
                        Evaluates image sharpness, guilloche borders, localized noise residuals, and baseline disparity.
                      </p>
                    </div>
                    {verification?.visual_evidence_summary?.quality_score && (
                      <span className="text-xs font-mono font-bold bg-slate-100 px-3 py-1.5 rounded-lg text-[#20242C] border border-[#E4E7EC]">
                        Image Quality: {verification.visual_evidence_summary.quality_score}%
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Document Preview Thumbnail */}
                    {currentFdr?.document_id && (
                      <div className="bg-slate-900 rounded-xl p-3 flex flex-col items-center justify-center min-h-[260px] border border-slate-700">
                        <img
                          src={getDocumentPreviewUrl(currentFdr.document_id)}
                          alt="FDR Original Evidence"
                          className="max-h-[240px] max-w-full object-contain rounded-lg shadow-md"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span className="text-[10px] font-mono text-slate-400 mt-2">
                          Original Forensic Scan Thumbnail &bull; SHA-256 Validated
                        </span>
                      </div>
                    )}

                    {/* Findings list */}
                    <div className="space-y-3">
                      {findings.map((f, idx) => (
                        <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-[#E4E7EC] text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#20242C] font-mono">{f.finding_type}</span>
                            <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-sm ${
                              f.severity === 'CRITICAL' ? 'bg-[#8B1E2D]/10 text-[#8B1E2D]' : f.severity === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-[#667085]'
                            }`}>
                              {f.severity}
                            </span>
                          </div>
                          <p className="text-[#20242C] mt-1.5 leading-relaxed">{f.explanation}</p>
                          <div className="mt-2 text-[10px] font-mono text-[#667085] flex items-center justify-between border-t border-[#E4E7EC] pt-1.5">
                            <span>Method: {f.detection_method}</span>
                            {f.bounding_box && <span>Box: [{f.bounding_box.map((n: number) => n.toFixed(2)).join(', ')}]</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Layer 2: Financial Math */}
              {activeLayer === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#20242C] flex items-center gap-2">
                        <span>Indian Banking Compound Interest Validation</span>
                      </h3>
                      <p className="text-xs text-[#667085] mt-0.5">
                        Deterministic mathematical reconciliation using NumPy compound interest schedules.
                      </p>
                    </div>
                  </div>

                  {verification?.mathematical_details && (
                    <div className="bg-slate-900 text-slate-100 rounded-xl p-5 font-mono text-xs space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-slate-800">
                        <div>
                          <span className="text-slate-400 text-[10px]">PRINTED MATURITY</span>
                          <div className="text-base font-bold text-emerald-400 mt-0.5">
                            ₹{verification.mathematical_details.printed_maturity_amount?.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px]">THEORETICAL MATURITY</span>
                          <div className="text-base font-bold text-slate-200 mt-0.5">
                            ₹{verification.mathematical_details.expected_maturity_exact?.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px]">VARIANCE DIFFERENCE</span>
                          <div className="text-base font-bold text-amber-400 mt-0.5">
                            ₹{verification.mathematical_details.absolute_difference?.toLocaleString()} ({verification.mathematical_details.percentage_difference}%)
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px]">COMPOUNDING SCHEME</span>
                          <div className="text-base font-bold text-slate-200 mt-0.5">
                            {verification.mathematical_details.compounding_frequency} (n={verification.mathematical_details.compounding_periods_per_year})
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 text-[11px]">
                        <strong>Formula Applied:</strong>{' '}
                        <code>{verification.mathematical_details.formula_used}</code> &bull; Tenure:{' '}
                        {verification.mathematical_details.stated_tenure_years} years ({verification.mathematical_details.days_elapsed} days)
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {findings.map((f, idx) => (
                      <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-[#E4E7EC] text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#20242C] font-mono">{f.finding_type}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-slate-200 text-[#667085] font-bold">
                            {f.severity}
                          </span>
                        </div>
                        <p className="text-[#20242C] mt-1 leading-relaxed">{f.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Layer 3: Bank Details & QR */}
              {activeLayer === 3 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#20242C] flex items-center gap-2">
                        <span>Institutional Entity &amp; QR Code Inspection</span>
                      </h3>
                      <p className="text-xs text-[#667085] mt-0.5">
                        Resolves bank IFSC against official RBI registry and verifies embedded QR payloads.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                      Bank Status: {verification?.bank_confirmation_status}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {findings.map((f, idx) => (
                      <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-[#E4E7EC] text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#20242C] font-mono">{f.finding_type}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-slate-200 text-[#667085] font-bold">
                            {f.severity}
                          </span>
                        </div>
                        <p className="text-[#20242C] mt-1 leading-relaxed">{f.explanation}</p>
                        <div className="mt-2 text-[10px] font-mono text-[#667085]">
                          Method: {f.detection_method}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Layer 4: Doubtful Digits */}
              {activeLayer === 4 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#20242C] flex items-center gap-2">
                        <span>Multi-Model OCR Candidate Agreement &amp; Digit Uncertainty</span>
                      </h3>
                      <p className="text-xs text-[#667085] mt-0.5">
                        Identifies potential 0/8, 1/7, or 5/6 digit ambiguities across numeric tokens.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {findings.map((f, idx) => (
                      <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-[#E4E7EC] text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#20242C] font-mono">{f.finding_type}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-slate-200 text-[#667085] font-bold">
                            {f.severity}
                          </span>
                        </div>
                        <p className="text-[#20242C] mt-1 leading-relaxed">{f.explanation}</p>
                        {f.evidence_data?.recommended_decision && (
                          <div className="mt-2 inline-block px-2 py-0.5 rounded-sm bg-slate-200 text-[#20242C] font-mono text-[10px] font-bold">
                            Recommended: {f.evidence_data.recommended_decision}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
