import { useState, useEffect } from 'react';
import {
  fetchDocuments,
  fetchDocumentExtraction,
  reviewExtractionFields,
  getDocumentPreviewUrl,
  type DocumentRecord,
  type ExtractionDetailsResponse,
  type ExtractionFieldItem,
} from '../services/api';
import type { NavigationTab } from './Sidebar';

interface Props {
  documentId?: string | null;
  onNavigate: (tab: NavigationTab) => void;
}

export default function UniversalReadingReview({ documentId, onNavigate }: Props) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(documentId || null);
  const [extraction, setExtraction] = useState<ExtractionDetailsResponse | null>(null);
  const [fields, setFields] = useState<ExtractionFieldItem[]>([]);
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Fetch list of documents for selector
  useEffect(() => {
    fetchDocuments({ pageSize: 30 })
      .then((res) => {
        setDocuments(res.documents);
        if (!selectedDocId && res.documents.length > 0) {
          const preferredDoc = res.documents.find((d) => d.processing_status === 'EXTRACTED') || res.documents[0];
          setSelectedDocId(preferredDoc.document_id);
        }
      })
      .catch((err) => console.warn('Failed listing documents:', err));
  }, []);

  // Fetch extraction data when selected document changes
  useEffect(() => {
    if (!selectedDocId) return;

    let mounted = true;
    setLoading(true);
    setSaveSuccessMsg(null);
    setEditingKey(null);

    fetchDocumentExtraction(selectedDocId)
      .then((data) => {
        if (mounted) {
          setExtraction(data);
          setFields(data.fields || []);
          if (data.fields && data.fields.length > 0) {
            setActiveFieldKey(data.fields[0].field_key);
          }
        }
      })
      .catch((err) => {
        console.error('Failed fetching extraction:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedDocId]);

  const activeField = fields.find((f) => f.field_key === activeFieldKey) || fields[0];

  const handleUpdateStatus = (fieldKey: string, status: ExtractionFieldItem['review_status']) => {
    setFields((prev) =>
      prev.map((f) => (f.field_key === fieldKey ? { ...f, review_status: status } : f))
    );
  };

  const handleStartEdit = (f: ExtractionFieldItem) => {
    setEditingKey(f.field_key);
    setEditValue(f.current_value);
  };

  const handleSaveEdit = (fieldKey: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.field_key === fieldKey) {
          const isEdited = editValue !== f.original_value;
          return {
            ...f,
            current_value: editValue,
            is_edited: isEdited,
            review_status: isEdited ? 'EDITED' : f.review_status,
          };
        }
        return f;
      })
    );
    setEditingKey(null);
  };

  const handleSaveAllReviews = async () => {
    if (!selectedDocId) return;
    setSaving(true);
    setSaveSuccessMsg(null);

    try {
      const payload = fields.map((f) => ({
        field_key: f.field_key,
        new_value: f.current_value,
        review_status: f.review_status as any,
      }));

      const res = await reviewExtractionFields(selectedDocId, payload, 'Verified via Universal Reading review interface');
      setSaveSuccessMsg(`Successfully saved ${res.updated_count} field reviews into PostgreSQL!`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed saving reviews');
    } finally {
      setSaving(false);
    }
  };

  // Convert bounding box [ymin, xmin, ymax, xmax] to CSS absolute percentages
  const getBoxStyle = (box: [number, number, number, number] | null) => {
    if (!box) return { display: 'none' };
    const [ymin, xmin, ymax, xmax] = box;
    return {
      top: `${ymin * 100}%`,
      left: `${xmin * 100}%`,
      height: `${(ymax - ymin) * 100}%`,
      width: `${(xmax - xmin) * 100}%`,
    };
  };

  const selectedDoc = documents.find((d) => d.document_id === selectedDocId);

  return (
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
      {/* Top Header & Document Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4E7EC] flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="telemetry-pill bg-[#8B1E2D]/10 text-[#8B1E2D] border border-[#8B1E2D]/20">
              DOCLING + OCR + QWEN2.5-VL PIPELINE
            </span>
            <span className="telemetry-pill bg-slate-100 text-[#667085] border border-[#E4E7EC]">
              SPATIAL BOUNDING BOX EVIDENCE
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#20242C] tracking-tight">
            Universal Reading Engine — Field Evidence &amp; Visual Audit
          </h2>
        </div>

        {/* Document Selector & Action Buttons */}
        <div className="flex items-center gap-2.5">
          <select
            aria-label="Select document for extraction review"
            value={selectedDocId || ''}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="text-xs border border-[#E4E7EC] rounded-xl px-3 py-2 bg-white text-[#20242C] font-semibold focus:outline-hidden focus:border-[#8B1E2D] shadow-2xs max-w-xs truncate cursor-pointer"
          >
            {documents.map((d) => (
              <option key={d.document_id} value={d.document_id}>
                {d.original_filename} ({d.file_type.split('/')[1]?.toUpperCase()})
              </option>
            ))}
          </select>

          <button
            onClick={() => onNavigate('upload')}
            className="px-4 py-2 rounded-xl border border-[#E4E7EC] hover:bg-slate-50 text-[#20242C] text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            Upload New
          </button>

          <button
            onClick={handleSaveAllReviews}
            disabled={saving || fields.length === 0}
            className="px-5 py-2 rounded-xl bg-[#16845B] hover:bg-[#126b49] text-white text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Field Reviews'}
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between flex-shrink-0">
          <span className="flex items-center gap-2"><strong className="font-bold">✓</strong> {saveSuccessMsg}</span>
          <button onClick={() => setSaveSuccessMsg(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Main Split-Screen Workspace (Phase 5 Requirement) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left Side: Document Preview with Spatial Bounding Box Overlay (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#E4E7EC] shadow-2xs p-4 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-[#E4E7EC] mb-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#20242C] flex items-center gap-1.5 font-mono">
                SOURCE EVIDENCE PREVIEW
              </span>
              {selectedDoc && (
                <span className="text-[10px] text-[#667085] font-mono">
                  ({selectedDoc.original_filename})
                </span>
              )}
            </div>

            {activeField && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-[#8B1E2D]/10 text-[#8B1E2D] border border-[#8B1E2D]/20 font-semibold">
                Focused: {activeField.field_label}
              </span>
            )}
          </div>

          {/* Interactive Document Viewport */}
          <div className="relative flex-1 bg-slate-100 rounded-xl overflow-hidden border border-[#E4E7EC] flex items-center justify-center">
            {selectedDocId ? (
              <div className="relative w-full h-full flex items-center justify-center overflow-auto p-4">
                {selectedDoc?.file_type === 'application/pdf' ? (
                  <iframe
                    src={getDocumentPreviewUrl(selectedDocId)}
                    title="PDF Evidence"
                    className="w-full h-full rounded border-0"
                  />
                ) : (
                  <div className="relative inline-block max-w-full max-h-full">
                    <img
                      src={getDocumentPreviewUrl(selectedDocId)}
                      alt="Receipt Document"
                      className="max-w-full max-h-[calc(100vh-280px)] object-contain rounded-lg shadow-2xs"
                    />

                    {/* Active Bounding Box Highlight Overlay */}
                    {activeField?.bounding_box && (
                      <div
                        className="absolute border-2 border-[#8B1E2D] bg-[#8B1E2D]/20 rounded shadow-md pointer-events-none transition-all duration-300 animate-pulse"
                        style={getBoxStyle(activeField.bounding_box)}
                      >
                        <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-[#8B1E2D] text-white text-[9px] font-mono font-bold whitespace-nowrap shadow-2xs">
                          {activeField.field_label}: {activeField.current_value}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#667085]">Select a document to inspect.</p>
            )}
          </div>
        </div>

        {/* Right Side: Extracted Fields with Evidence, Confidence & Actions (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#E4E7EC] shadow-2xs flex flex-col overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-[#E4E7EC] flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-xs font-bold text-[#20242C] font-orbitron uppercase tracking-wider">
                Extracted Fields &amp; Normalization
              </h3>
              <p className="text-[10px] text-[#667085] font-mono">
                Confidence: <strong>{Math.round((extraction?.extraction_confidence || 0.94) * 100)}%</strong> · Pipeline: {extraction?.tool_pipeline || 'Docling + Vision'}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-200 text-[#20242C]">
              {fields.length} Entities
            </span>
          </div>

          {/* Fields Scrollable List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-[#E4E7EC]">
            {loading ? (
              <div className="py-16 text-center text-[#667085]">
                <div className="inline-block w-6 h-6 border-2 border-[#8B1E2D] border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs font-medium">Extracting financial entities &amp; coordinates...</p>
              </div>
            ) : fields.length === 0 ? (
              <div className="py-16 text-center text-[#667085]">
                <p className="text-xs font-semibold text-[#20242C]">No extracted fields available.</p>
                <p className="text-[10px] text-[#667085] mt-1">Upload a document to run the Universal Reading Engine.</p>
              </div>
            ) : (
              fields.map((f) => {
                const isSelected = activeFieldKey === f.field_key;
                const isEditing = editingKey === f.field_key;

                return (
                  <div
                    key={f.id || f.field_key}
                    onClick={() => setActiveFieldKey(f.field_key)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#8B1E2D] bg-[#8B1E2D]/5 shadow-2xs ring-1 ring-[#8B1E2D]'
                        : 'border-[#E4E7EC] bg-slate-50/40 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#20242C] flex items-center gap-1.5">
                        {f.field_label}
                        {f.is_edited && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            EDITED
                          </span>
                        )}
                      </span>

                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/60 text-[#667085] font-semibold">
                        {Math.round(f.ocr_confidence * 100)}% conf
                      </span>
                    </div>

                    {/* Value Area (or inline Edit input) */}
                    <div className="mt-1.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#8B1E2D] text-xs text-[#20242C] font-semibold focus:outline-hidden bg-white"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(f.field_key)}
                            className="px-2.5 py-1.5 bg-[#8B1E2D] hover:bg-[#6F1724] text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingKey(null)}
                            className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-[#20242C] rounded-lg text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-[#20242C] font-mono">
                            {f.current_value || '—'}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(f);
                            }}
                            className="text-[11px] text-[#667085] hover:text-[#20242C] font-medium px-2 py-0.5 rounded-lg hover:bg-slate-200/50 cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Original Value preservation notice */}
                    {f.is_edited && (
                      <p className="text-[10px] text-[#667085] font-mono mt-1">
                        Original Extracted: <span className="line-through">{f.original_value}</span>
                      </p>
                    )}

                    {/* Action buttons: Accept / Uncertain / Review */}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#E4E7EC] text-[10px]">
                      <span className="font-mono text-[#667085]">
                        {f.extraction_method} · P.{f.source_page}
                      </span>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleUpdateStatus(f.field_key, 'ACCEPTED')}
                          className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                            f.review_status === 'ACCEPTED'
                              ? 'bg-[#16845B] text-white'
                              : 'bg-emerald-50 text-[#16845B] hover:bg-emerald-100'
                          }`}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(f.field_key, 'UNCERTAIN')}
                          className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                            f.review_status === 'UNCERTAIN'
                              ? 'bg-amber-600 text-white'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          Uncertain
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(f.field_key, 'MANUAL_REVIEW_REQUESTED')}
                          className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                            f.review_status === 'MANUAL_REVIEW_REQUESTED'
                              ? 'bg-[#8B1E2D] text-white'
                              : 'bg-[#8B1E2D]/10 text-[#8B1E2D] hover:bg-[#8B1E2D]/20'
                          }`}
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
