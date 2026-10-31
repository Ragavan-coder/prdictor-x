import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '../App';
import Sidebar, { type NavigationTab } from './Sidebar';
import FDRManagementDashboard from './FDRManagementDashboard';
import FDRRecordsTable from './FDRRecordsTable';
import DocumentUploadCenter from './DocumentUploadCenter';
import UniversalReadingReview from './UniversalReadingReview';
import SecurityAlertCenter from './SecurityAlertCenter';
import LiveTelemetryStream from './LiveTelemetryStream';
import { SentraVerificationCenter } from './SentraVerificationCenter';
import { AIGuardianWorkspace } from './AIGuardianWorkspace';
import { DuplicateIntelligence } from './DuplicateIntelligence';
import { RiskIntelligenceEngine } from './RiskIntelligenceEngine';
import { NotificationAlertCenter } from './NotificationAlertCenter';
import { LifecycleMonitoringWorkspace } from './LifecycleMonitoringWorkspace';
import { AuditEvidenceWorkspace } from './AuditEvidenceWorkspace';

interface Props {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: Props) {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [alertCenterOpen, setAlertCenterOpen] = useState(false);
  const [telemetryOpen, setTelemetryOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen bg-[#F5F6F8] text-slate-800 overflow-hidden font-sans select-none">
      {/* 1. Enterprise Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        user={user}
        onLogout={onLogout}
      />

      {/* 2. Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar */}
        <header
          className="bg-white border-b border-[#E4E7EC] px-5 flex items-center justify-between flex-shrink-0 z-20 shadow-2xs"
          style={{ height: '3.75rem', minHeight: '3.75rem' }}
        >
          {/* Left: Breadcrumbs & System Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2" style={{ fontSize: '0.8rem' }}>
              <span className="font-semibold text-slate-400 uppercase tracking-wide">PREDICTRA-X</span>
              <span className="text-slate-300 font-light">/</span>
              <span className="font-bold text-slate-900 uppercase tracking-wider font-orbitron" style={{ fontSize: '0.72rem' }}>
                {currentTab.replace('-', ' ')}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-[#E4E7EC]">
              <span className="font-mono text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80" style={{ fontSize: '0.72rem' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                KEYCLOAK: predictra-x
              </span>
              <span className="font-mono text-slate-600 font-semibold hidden md:flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-full border border-[#E4E7EC]" style={{ fontSize: '0.72rem' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                POSTGRESQL SYNC
              </span>
            </div>
          </div>

          {/* Right: Telemetry & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Live Telemetry Socket Trigger */}
            <button
              onClick={() => setTelemetryOpen(!telemetryOpen)}
              className="px-3.5 py-1.5 rounded-lg border border-cyan-200/80 bg-cyan-50/60 hover:bg-cyan-100/70 text-cyan-900 font-mono font-bold flex items-center gap-2 transition-all shadow-sm"
              style={{ fontSize: '0.78rem' }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
              </span>
              <span className="hidden sm:inline">Telemetry</span>
            </button>

            {/* Security Alert Center Trigger */}
            <button
              onClick={() => setAlertCenterOpen(true)}
              className="px-3.5 py-1.5 rounded-lg border border-[#E4E7EC] bg-white hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              style={{ fontSize: '0.78rem' }}
            >
              <span className="text-amber-500">🔔</span>
              <span>Alerts</span>
            </button>
          </div>
        </header>

        {/* Dynamic View Body */}
        <main className="flex-1 overflow-y-auto min-w-0 bg-[#F5F6F8]" style={{ padding: 'clamp(1rem, 2.5vw, 1.75rem)' }}>
          <div className="max-w-[1700px] w-full mx-auto">
            <AnimatePresence mode="wait">
              {currentTab === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <FDRManagementDashboard
                    onNavigate={setCurrentTab}
                    onSelectFDR={(fdrId) => {
                      setSelectedDocId(fdrId);
                      setCurrentTab('reading');
                    }}
                  />
                </motion.div>
              )}

              {currentTab === 'records' && (
                <motion.div
                  key="records"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <FDRRecordsTable
                    onNavigate={setCurrentTab}
                    onInspectDocument={(docId) => {
                      setSelectedDocId(docId);
                      setCurrentTab('reading');
                    }}
                  />
                </motion.div>
              )}

              {currentTab === 'upload' && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <DocumentUploadCenter
                    onNavigate={setCurrentTab}
                    onOpenUniversalReading={(docId) => {
                      setSelectedDocId(docId);
                      setCurrentTab('reading');
                    }}
                  />
                </motion.div>
              )}

              {currentTab === 'reading' && (
                <motion.div
                  key="reading"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <UniversalReadingReview
                    documentId={selectedDocId}
                    onNavigate={setCurrentTab}
                  />
                </motion.div>
              )}

              {currentTab === 'verification' && (
                <motion.div
                  key="verification"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <SentraVerificationCenter />
                </motion.div>
              )}

              {currentTab === 'ai-guardian' && (
                <motion.div
                  key="ai-guardian"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <AIGuardianWorkspace />
                </motion.div>
              )}

              {currentTab === 'duplicates' && (
                <motion.div
                  key="duplicates"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <DuplicateIntelligence />
                </motion.div>
              )}

              {currentTab === 'risk' && (
                <motion.div
                  key="risk"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <RiskIntelligenceEngine />
                </motion.div>
              )}

              {currentTab === 'alerts' && (
                <motion.div
                  key="alerts"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <NotificationAlertCenter />
                </motion.div>
              )}

              {currentTab === 'lifecycle' && (
                <motion.div
                  key="lifecycle"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <LifecycleMonitoringWorkspace />
                </motion.div>
              )}

              {currentTab === 'audit' && (
                <motion.div
                  key="audit"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <AuditEvidenceWorkspace />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Security Alert Center Modal */}
      <SecurityAlertCenter
        isOpen={alertCenterOpen}
        onClose={() => setAlertCenterOpen(false)}
        onAlertCountChange={() => { }}
      />

      {/* Live Telemetry Modal */}
      {telemetryOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-fade-in-up">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 font-orbitron" style={{ fontSize: '0.82rem' }}>
                Live FDR Telemetry &amp; Sensor Stream
              </h3>
              <button
                onClick={() => setTelemetryOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold flex items-center justify-center transition-colors"
                style={{ fontSize: '0.8rem' }}
              >
                ✕
              </button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto">
              <LiveTelemetryStream />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
