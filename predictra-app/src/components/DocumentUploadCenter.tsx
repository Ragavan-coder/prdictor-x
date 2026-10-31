import { useState, useRef } from 'react';
import {
  uploadFDRDocument,
  fetchDocumentStatus,
  type DocumentRecord,
} from '../services/api';
import type { NavigationTab } from './Sidebar';

interface Props {
  onNavigate: (tab: NavigationTab) => void;
  onOpenUniversalReading: (documentId: string) => void;
}

export default function DocumentUploadCenter({ onNavigate, onOpenUniversalReading }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    message: string;
    existing_document_id: string;
  } | null>(null);
  const [processedDoc, setProcessedDoc] = useState<DocumentRecord | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [processingPct, setProcessingPct] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    setErrorMsg(null);
    setDuplicateInfo(null);
    setProcessedDoc(null);
    setProcessingStatus(null);
    setProcessingPct(0);

    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setErrorMsg('Invalid file format. Please upload a PDF, JPG, or PNG document.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('File exceeds 25MB maximum allowable upload size.');
      return;
    }

    setSelectedFile(file);

    // Create preview
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(15);
    setErrorMsg(null);
    setDuplicateInfo(null);

    try {
      // Simulate smooth upload progress
      const progressTimer = setInterval(() => {
        setUploadProgress((p) => (p < 85 ? p + 15 : p));
      }, 150);

      const res = await uploadFDRDocument(selectedFile);
      clearInterval(progressTimer);
      setUploadProgress(100);

      if (res.is_duplicate && res.existing_document_id) {
        setDuplicateInfo({
          message: res.message,
          existing_document_id: res.existing_document_id,
        });
        setUploading(false);
        return;
      }

      if (res.document) {
        setProcessedDoc(res.document);
        pollProcessingStatus(res.document.document_id);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const pollProcessingStatus = (docId: string) => {
    setProcessingStatus('VALIDATING');
    setProcessingPct(20);

    const interval = setInterval(async () => {
      try {
        const statusRes = await fetchDocumentStatus(docId);
        setProcessingStatus(statusRes.current_stage);
        setProcessingPct(statusRes.progress_pct);

        if (statusRes.completed) {
          clearInterval(interval);
          setProcessingPct(100);
          setProcessingStatus(statusRes.processing_status);
        }
      } catch (e) {
        console.warn('Status poll error:', e);
      }
    }, 800);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setErrorMsg(null);
    setDuplicateInfo(null);
    setProcessedDoc(null);
    setProcessingStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 1. Masthead Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 px-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="telemetry-pill bg-rose-50 text-rose-800 border border-rose-200/80">
              SECURE INGESTION GATEWAY
            </span>
            <span className="telemetry-pill bg-slate-100 text-slate-700 border border-slate-200">
              SHA-256 DEDUPLICATION
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 font-orbitron tracking-tight">
            FDR Document Upload Center
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Upload bank fixed deposit receipts (PDF, JPG, PNG) for multi-layer cryptographic verification
          </p>
        </div>

        <button
          onClick={() => onNavigate('records')}
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs flex items-center gap-2 transition-all hover:border-slate-300 self-start sm:self-auto"
        >
          View FDR Repository →
        </button>
      </div>

      {/* Upload Drag & Drop Area — Standardized Enterprise Box Spacing */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl px-8 sm:px-14 md:px-16 py-10 sm:py-12 text-center transition-all ${
          isDragOver
            ? 'border-[#8B1E2D] bg-[#8B1E2D]/5'
            : selectedFile
            ? 'border-emerald-400 bg-emerald-50/20'
            : 'border-[#E4E7EC] bg-white hover:border-[#8B1E2D]/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
        />

        {!selectedFile ? (
          <div className="space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#8B1E2D]/8 flex items-center justify-center text-3xl text-[#8B1E2D] shadow-xs">
              📄
            </div>
            <div>
              <p className="text-base sm:text-lg font-bold text-slate-900 font-rajdhani tracking-wide">
                Drag and drop your FDR document here
              </p>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Supports PDF, JPG, JPEG, and PNG files up to 25MB
              </p>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 rounded-xl bg-[#8B1E2D] hover:bg-[#6F1724] text-white text-xs sm:text-sm font-bold shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span>📁</span> Browse Files
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl">📑</span>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900 truncate max-w-md">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type || 'Document'}
                </p>
              </div>
            </div>

            {/* Image Preview if applicable */}
            {filePreviewUrl && (
              <div className="max-w-xs mx-auto rounded-xl overflow-hidden border border-slate-200 shadow-xs">
                <img src={filePreviewUrl} alt="Preview" className="w-full h-auto max-h-48 object-contain bg-slate-50" />
              </div>
            )}

            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="px-6 py-2.5 rounded-xl bg-[#8B1E2D] hover:bg-[#6F1724] text-white text-xs sm:text-sm font-semibold shadow-xs flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                <span>🚀</span> {uploading ? 'Validating & Uploading...' : 'Upload & Process with Universal Reading Engine'}
              </button>

              <button
                type="button"
                onClick={clearSelection}
                disabled={uploading}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-all cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Progress Bar */}
      {uploading && (
        <div className="bg-white p-5 rounded-2xl border border-[#E4E7EC] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
            <span className="text-slate-700">Validating magic bytes & streaming to secure storage...</span>
            <span className="font-mono text-[#8B1E2D] font-bold">{uploadProgress}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-[#8B1E2D] transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Duplicate Document Detection Dialog (Phase 3 Requirement) */}
      {duplicateInfo && (
        <div className="p-5 rounded-xl bg-amber-50 border border-amber-300 shadow-xs space-y-3 animate-fade-in-up">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider font-mono">
                DUPLICATE DOCUMENT DETECTED (SHA-256 MATCH)
              </h4>
              <p className="text-xs text-amber-800 mt-1">
                {duplicateInfo.message}
              </p>
              <p className="text-[11px] font-mono text-amber-700 mt-1">
                Existing Document ID: <strong>{duplicateInfo.existing_document_id}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-amber-200">
            <button
              onClick={() => onOpenUniversalReading(duplicateInfo.existing_document_id)}
              className="px-4 py-2 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <span>👁️</span> View Existing Document in Universal Reading
            </button>
            <button
              onClick={clearSelection}
              className="px-3.5 py-2 rounded-lg border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Processing Pipeline Live Status (Phase 7 Requirement) */}
      {processedDoc && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                UPLOAD COMPLETE
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-1">
                Universal Reading Engine: {processingStatus || 'PROCESSING'}
              </h3>
            </div>
            <div className="text-right">
              <span className="text-base font-bold font-mono text-slate-900">
                {processingPct}%
              </span>
              <p className="text-[10px] text-slate-400 font-mono">STAGE PROGRESS</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ease-out ${
                processingPct === 100 ? 'bg-emerald-500' : 'bg-red-600'
              }`}
              style={{ width: `${processingPct}%` }}
            />
          </div>

          {/* Stages Breakdown */}
          <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono">
            <div className={`p-2 rounded border ${processingPct >= 20 ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
              1. VALIDATE
            </div>
            <div className={`p-2 rounded border ${processingPct >= 40 ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
              2. DOCLING PDF
            </div>
            <div className={`p-2 rounded border ${processingPct >= 65 ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
              3. OCR BOUNDS
            </div>
            <div className={`p-2 rounded border ${processingPct >= 100 ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
              4. EXTRACTED
            </div>
          </div>

          {/* Navigation to Universal Reading Screen */}
          {processingPct === 100 && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                <span>✅</span> All financial entities and spatial bounding boxes extracted!
              </span>

              <button
                onClick={() => onOpenUniversalReading(processedDoc.document_id)}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
              >
                Inspect Extracted Evidence →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Security Guidance Footer */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
        <p className="font-bold text-slate-800">🔒 Security & Compliance Architecture:</p>
        <p>• Every uploaded document is hashed with SHA-256 before disk/MinIO placement.</p>
        <p>• Magic byte inspection ensures executable or disguised scripts are rejected before parsing.</p>
        <p>• Original documents are stored byte-for-byte unmodified to maintain tamper-evident legal standing.</p>
      </div>
    </div>
  );
}
