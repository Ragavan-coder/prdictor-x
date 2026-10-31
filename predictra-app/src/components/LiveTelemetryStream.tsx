import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getTelemetryWebSocketUrl,
  type LiveTelemetryScan,
  type TelemetryMetrics,
} from '../services/api';

export default function LiveTelemetryStream() {
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [scans, setScans] = useState<LiveTelemetryScan[]>([]);
  const [metrics, setMetrics] = useState<TelemetryMetrics>({
    throughput_fps: 18.2,
    avg_latency_ms: 38,
    anomaly_rate_pct: 2.1,
    total_scanned: 14280,
    connected_peers: 1,
  });
  const [latencyHistory, setLatencyHistory] = useState<number[]>([36, 42, 38, 45, 34, 40, 38]);
  const wsRef = useRef<WebSocket | null>(null);
  const isPausedRef = useRef(paused);
  isPausedRef.current = paused;

  useEffect(() => {
    let reconnectTimeout: any = null;
    let ws: WebSocket | null = null;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;
      const url = getTelemetryWebSocketUrl();
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isDisposed) return;
        setConnected(true);
      };

      ws.onmessage = (event) => {
        if (isDisposed) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'TELEMETRY_SCAN' || payload.type === 'MANUAL_SCAN_RESULT') {
            if (!isPausedRef.current && payload.scan) {
              setScans((prev) => [payload.scan, ...prev.slice(0, 49)]);
              if (payload.scan.total_latency_ms) {
                setLatencyHistory((prev) => [...prev.slice(1), payload.scan.total_latency_ms]);
              }
            }
            if (payload.metrics) {
              setMetrics(payload.metrics);
            }
          } else if (payload.type === 'LIVE_VERIFICATION_EVENT' && payload.scan) {
            setScans((prev) => [payload.scan, ...prev.slice(0, 49)]);
          }
        } catch (err) {
          console.warn('Failed parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        if (isDisposed) return;
        setConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.warn('Telemetry WebSocket error:', err);
        ws?.close();
      };
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, []);

  const handleTriggerManualScan = (forceAnomaly: boolean = false) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: 'trigger_scan',
          force_anomaly: forceAnomaly,
        })
      );
    }
  };

  const handleClearStream = () => {
    setScans([]);
  };

  return (
    <div className="bg-white rounded-b-xl border border-[#E4E7EC] p-6 shadow-2xs font-rajdhani">
      {/* ── Status Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E7EC]">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="font-orbitron font-bold text-base text-[#20242C] tracking-tight flex items-center gap-2">
              REAL-TIME FDR TELEMETRY STREAM
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-orbitron text-[0.62rem] font-bold tracking-wider border ${
                connected
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-amber-50 border-amber-300 text-amber-800'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {connected ? 'WEBSOCKET ONLINE (WSS / RFC 6455)' : 'CONNECTING...'}
            </span>
          </div>
          <p className="font-rajdhani text-xs text-[#667085] mt-1">
            Real-time feed of multi-bank deposit receipts evaluated across SENTRA Layers 1–4.
          </p>
        </div>

        {/* Stream Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setPaused(!paused)}
            className={`px-3 py-1.5 rounded-xl font-orbitron text-[0.65rem] font-bold tracking-wider transition-all cursor-pointer border ${
              paused
                ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                : 'bg-slate-100 text-[#20242C] border-[#E4E7EC] hover:bg-slate-200'
            }`}
          >
            {paused ? '▶ RESUME STREAM' : '⏸ PAUSE FEED'}
          </button>
          <button
            onClick={() => handleTriggerManualScan(false)}
            disabled={!connected}
            className="px-3.5 py-1.5 rounded-xl bg-[#20242C] text-white font-orbitron text-[0.65rem] font-bold tracking-wider hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-50"
          >
            + SCAN RECEIPT
          </button>
          <button
            onClick={() => handleTriggerManualScan(true)}
            disabled={!connected}
            className="px-3.5 py-1.5 rounded-xl bg-[#8B1E2D] text-white font-orbitron text-[0.65rem] font-bold tracking-wider hover:bg-[#6F1724] transition-all cursor-pointer disabled:opacity-50"
            title="Inject an artificial calculation or digit anomaly"
          >
            ! INJECT ANOMALY
          </button>
          <button
            onClick={handleClearStream}
            className="px-3 py-1.5 rounded-xl bg-slate-100 text-[#667085] font-orbitron text-[0.65rem] font-bold hover:bg-slate-200 transition-all cursor-pointer border border-[#E4E7EC]"
            title="Clear stream console"
          >
            CLEAR
          </button>
        </div>
      </div>

      {/* ── Metric Scorecards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-5">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E4E7EC]">
          <div className="font-orbitron text-[0.62rem] text-[#667085] font-semibold uppercase tracking-wider">
            Verification Throughput
          </div>
          <div className="font-orbitron text-lg font-bold text-[#20242C] mt-1">
            {metrics.throughput_fps}{' '}
            <span className="text-xs font-normal text-[#667085]">fps</span>
          </div>
          <div className="font-rajdhani text-[0.68rem] text-emerald-600 mt-0.5">
            ● Real-time buffer active
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E4E7EC]">
          <div className="font-orbitron text-[0.62rem] text-[#667085] font-semibold uppercase tracking-wider">
            Mean Pipeline Latency
          </div>
          <div className="font-orbitron text-lg font-bold text-[#20242C] mt-1">
            {metrics.avg_latency_ms}{' '}
            <span className="text-xs font-normal text-[#667085]">ms</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            {latencyHistory.map((val, idx) => (
              <div
                key={idx}
                className="w-2 rounded-xs bg-[#8B1E2D]/40"
                style={{ height: `${Math.min(18, Math.max(4, val / 3))}px` }}
                title={`${val} ms`}
              />
            ))}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E4E7EC]">
          <div className="font-orbitron text-[0.62rem] text-[#667085] font-semibold uppercase tracking-wider">
            Detected Anomaly Rate
          </div>
          <div className="font-orbitron text-lg font-bold text-[#8B1E2D] mt-1">
            {metrics.anomaly_rate_pct}%
          </div>
          <div className="font-rajdhani text-[0.68rem] text-[#667085] mt-0.5">
            4-layer filter threshold
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-[#E4E7EC]">
          <div className="font-orbitron text-[0.62rem] text-[#667085] font-semibold uppercase tracking-wider">
            Total Scanned FDRs
          </div>
          <div className="font-orbitron text-lg font-bold text-[#20242C] mt-1">
            {metrics.total_scanned.toLocaleString()}
          </div>
          <div className="font-rajdhani text-[0.68rem] text-[#667085] mt-0.5">
            Chained in SHA-256 Merkle log
          </div>
        </div>
      </div>

      {/* ── Live Stream Console ── */}
      <div className="rounded-xl border border-neutral-200 overflow-hidden bg-neutral-900 shadow-inner">
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-950 border-b border-neutral-800">
          <div className="flex items-center gap-2 font-orbitron text-[0.65rem] text-neutral-400 font-bold tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            LIVE TELEMETRY FEED ({scans.length} IN BUFFER)
          </div>
          <div className="text-[0.65rem] text-neutral-500 font-mono">
            PORT: 8000/ws/telemetry
          </div>
        </div>

        <div className="p-3 max-h-[500px] overflow-y-auto space-y-2.5 divide-y divide-neutral-800">
          {scans.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 font-rajdhani text-sm">
              <div className="font-orbitron text-xs text-neutral-400 mb-1">
                STREAMING CHANNEL INITIALIZING...
              </div>
              Waiting for incoming FDR evaluation telemetry packets...
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {scans.map((scan) => {
                const isAnomaly = scan.status === 'FLAGGED_ANOMALY';
                return (
                  <motion.div
                    key={`${scan.receipt_number}-${scan.timestamp}`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`pt-2.5 first:pt-0 p-3 rounded-lg border transition-all ${
                      isAnomaly
                        ? 'bg-red-950/30 border-red-900/60'
                        : 'bg-neutral-800/40 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-orbitron text-xs font-bold text-white tracking-wider">
                          {scan.receipt_number}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-neutral-700/60 text-neutral-300 font-rajdhani text-[0.68rem] font-semibold">
                          {scan.bank}
                        </span>
                        <span className="font-mono text-[0.65rem] text-neutral-400">
                          {scan.iso_time}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full font-orbitron text-[0.6rem] font-bold tracking-wider border ${
                            isAnomaly
                              ? 'bg-red-500/10 border-red-500/40 text-red-400'
                              : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                          }`}
                        >
                          {isAnomaly ? 'FLAGGED ANOMALY' : 'VERIFIED AUTHENTIC'}
                        </span>
                        <span className="text-[0.65rem] font-mono text-neutral-400">
                          {scan.total_latency_ms}ms
                        </span>
                      </div>
                    </div>

                    {/* Financial Figures */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-neutral-800/60 font-rajdhani text-xs text-neutral-300">
                      <div>
                        <span className="text-neutral-500">Principal:</span>{' '}
                        <strong>₹{scan.principal.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500">Maturity:</span>{' '}
                        <strong>₹{scan.maturity_amount.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="text-neutral-500">Rate / Term:</span>{' '}
                        <strong>
                          {scan.interest_rate}% ({scan.tenure_months}m)
                        </strong>
                      </div>
                      <div>
                        <span className="text-neutral-500">Confidence:</span>{' '}
                        <strong
                          className={isAnomaly ? 'text-red-400' : 'text-emerald-400'}
                        >
                          {scan.confidence_score}%
                        </strong>
                      </div>
                    </div>

                    {/* Layer Badges */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[0.62rem] font-orbitron text-neutral-500">
                        LAYERS:
                      </span>
                      <span
                        className={`text-[0.6rem] font-mono px-1.5 py-0.5 rounded ${
                          scan.layer_breakdown.layer1_evidence === 'PASSED'
                            ? 'bg-neutral-800 text-neutral-300'
                            : 'bg-red-900/60 text-red-300 border border-red-600'
                        }`}
                      >
                        L1: EVIDENCE
                      </span>
                      <span
                        className={`text-[0.6rem] font-mono px-1.5 py-0.5 rounded ${
                          scan.layer_breakdown.layer2_calc === 'PASSED'
                            ? 'bg-neutral-800 text-neutral-300'
                            : 'bg-red-900/60 text-red-300 border border-red-600'
                        }`}
                      >
                        L2: CALC
                      </span>
                      <span
                        className={`text-[0.6rem] font-mono px-1.5 py-0.5 rounded ${
                          scan.layer_breakdown.layer3_bank === 'PASSED'
                            ? 'bg-neutral-800 text-neutral-300'
                            : 'bg-red-900/60 text-red-300 border border-red-600'
                        }`}
                      >
                        L3: BANK
                      </span>
                      <span
                        className={`text-[0.6rem] font-mono px-1.5 py-0.5 rounded ${
                          scan.layer_breakdown.layer4_digits === 'PASSED'
                            ? 'bg-neutral-800 text-neutral-300'
                            : 'bg-red-900/60 text-red-300 border border-red-600'
                        }`}
                      >
                        L4: DIGITS
                      </span>
                    </div>

                    {/* Anomaly Details Alert */}
                    {isAnomaly && scan.anomaly_title && (
                      <div className="mt-2.5 p-2 rounded bg-red-950/50 border border-red-800/80 text-red-300 font-rajdhani text-xs">
                        <strong>⚠️ {scan.anomaly_title}:</strong> {scan.anomaly_description}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
