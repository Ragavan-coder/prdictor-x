import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchRecentAlerts,
  fetchAlertConfig,
  updateAlertConfig,
  triggerTestAlert,
  type SecurityAlert,
  type NotificationConfig,
} from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAlertCountChange?: (count: number) => void;
}

export default function SecurityAlertCenter({ isOpen, onClose, onAlertCountChange }: Props) {
  const [tab, setTab] = useState<'feed' | 'settings'>('feed');
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [config, setConfig] = useState<NotificationConfig>({
    webhook_url: '',
    webhook_enabled: false,
    email_recipient: 'security@predictra.x',
    email_enabled: false,
    min_severity: 'HIGH',
  });
  const [loading, setLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [alertList, alertCfg] = await Promise.allSettled([
        fetchRecentAlerts(40),
        fetchAlertConfig(),
      ]);
      if (alertList.status === 'fulfilled') {
        setAlerts(alertList.value);
        if (onAlertCountChange) onAlertCountChange(alertList.value.length);
      }
      if (alertCfg.status === 'fulfilled') {
        setConfig(alertCfg.value);
      }
    } catch (e) {
      console.warn('Failed loading alert data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      const interval = setInterval(loadData, 12000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg('');
    setErrorMsg('');
    try {
      await updateAlertConfig(config);
      setStatusMsg('Notification & Webhook settings updated successfully.');
      setTimeout(() => setStatusMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update alert config');
    }
  };

  const handleSendTestAlert = async (severity: string) => {
    setTestSending(true);
    setStatusMsg('');
    setErrorMsg('');
    try {
      const newAlert = await triggerTestAlert({
        title: `Manual SOC Incident Broadcast`,
        severity,
        description: `Operator broadcasted simulated ${severity} security alert. Verifying dispatch channels.`,
      });
      setAlerts((prev) => [newAlert, ...prev]);
      setStatusMsg(`Dispatched [${severity}] test alert. Check webhook/logs!`);
      setTimeout(() => setStatusMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch test alert');
    } finally {
      setTestSending(false);
    }
  };

  if (!isOpen) return null;

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-600 border-red-500/30';
      case 'HIGH':
        return 'bg-[#C8102E]/10 text-[#C8102E] border-[#C8102E]/30';
      case 'WARNING':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      default:
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C8102E] animate-ping" />
              <div>
                <h3 className="font-orbitron font-bold text-sm tracking-wider uppercase text-neutral-900">
                  Automated Security Alerts & Webhook Dispatcher
                </h3>
                <p className="font-rajdhani text-xs text-neutral-500">
                  Real-time SOC incident broadcasts, TOTP failures, and external webhooks
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-700 transition-colors p-1 cursor-pointer font-bold text-lg"
            >
              ✕
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-neutral-200 bg-white">
            <button
              onClick={() => setTab('feed')}
              className={`flex-1 py-2.5 font-orbitron text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
                tab === 'feed'
                  ? 'border-[#C8102E] text-[#C8102E] bg-red-50/20'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Live Incident Feed ({alerts.length})
            </button>
            <button
              onClick={() => setTab('settings')}
              className={`flex-1 py-2.5 font-orbitron text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border-b-2 ${
                tab === 'settings'
                  ? 'border-[#C8102E] text-[#C8102E] bg-red-50/20'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Webhook & Email Settings
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 overflow-y-auto flex-1 font-rajdhani">
            {statusMsg && (
              <div className="mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
                <span>✓</span>
                <span>{statusMsg}</span>
              </div>
            )}
            {errorMsg && (
              <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 font-semibold flex items-center gap-2">
                <span>⚠</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {tab === 'feed' ? (
              <div className="space-y-3">
                {/* Action Bar */}
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100 text-xs">
                  <span className="text-neutral-500 font-semibold">
                    {loading ? 'Refreshing incidents...' : `Showing latest ${alerts.length} incidents`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={testSending}
                      onClick={() => handleSendTestAlert('HIGH')}
                      className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-white font-orbitron text-[0.62rem] tracking-wider uppercase font-bold cursor-pointer transition-colors"
                    >
                      {testSending ? 'Sending...' : '⚡ Test High Alert'}
                    </button>
                    <button
                      type="button"
                      disabled={testSending}
                      onClick={() => handleSendTestAlert('CRITICAL')}
                      className="px-2.5 py-1 rounded bg-[#C8102E] hover:bg-[#A00D24] text-white font-orbitron text-[0.62rem] tracking-wider uppercase font-bold cursor-pointer transition-colors"
                    >
                      {testSending ? 'Sending...' : '🚨 Test Critical Alert'}
                    </button>
                  </div>
                </div>

                {/* Alerts List */}
                {alerts.length === 0 ? (
                  <div className="text-center py-10 text-neutral-400 text-sm">
                    No security incidents recorded. System running nominal.
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 transition-all flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-orbitron text-[0.6rem] font-bold px-2 py-0.5 rounded-md border uppercase ${getSeverityBadge(
                              alert.severity
                            )}`}
                          >
                            {alert.severity}
                          </span>
                          <span className="font-bold text-neutral-900 text-xs font-orbitron">
                            {alert.title}
                          </span>
                        </div>
                        <span className="text-[0.68rem] text-neutral-400 font-mono">
                          {alert.iso_time.replace('T', ' ').replace('Z', ' UTC')}
                        </span>
                      </div>

                      <p className="text-xs text-neutral-600 leading-relaxed">
                        {alert.description}
                      </p>

                      <div className="flex items-center justify-between pt-1 text-[0.68rem] text-neutral-400 border-t border-neutral-100">
                        <div className="flex items-center gap-3">
                          <span>
                            Actor: <strong className="text-neutral-700">{alert.actor}</strong>
                          </span>
                          <span>
                            Event: <code className="bg-neutral-200/60 px-1 rounded text-neutral-700">{alert.event_type}</code>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 font-semibold text-neutral-500">
                            Webhook:{' '}
                            <span className={alert.dispatched_webhook ? 'text-emerald-600' : 'text-neutral-400'}>
                              {alert.dispatched_webhook ? '✓ Dispatched' : '○ Standby'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            ) : (
              <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
                {/* Webhook Configuration */}
                <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-orbitron font-bold text-neutral-900 text-xs uppercase tracking-wider">
                        Slack / Discord / Teams Webhook
                      </h4>
                      <p className="text-neutral-500 text-[0.72rem] mt-0.5">
                        Broadcasts real-time security incident alerts to your SOC channel
                      </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={config.webhook_enabled}
                        onChange={(e) => setConfig((c) => ({ ...c, webhook_enabled: e.target.checked }))}
                        className="rounded text-[#C8102E] focus:ring-[#C8102E] cursor-pointer"
                      />
                      <span className="font-bold text-neutral-800 font-orbitron text-[0.65rem]">
                        {config.webhook_enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </label>
                  </div>

                  <input
                    type="url"
                    value={config.webhook_url || ''}
                    onChange={(e) => setConfig((c) => ({ ...c, webhook_url: e.target.value }))}
                    placeholder="https://hooks.slack.com/services/... or https://discord.com/api/webhooks/..."
                    className="secure-input text-xs w-full font-mono"
                  />
                  <span className="text-[0.68rem] text-neutral-400">
                    Supports incoming webhook format for Slack, Discord channels, and Microsoft Teams.
                  </span>
                </div>

                {/* Email Dispatcher Configuration */}
                <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-orbitron font-bold text-neutral-900 text-xs uppercase tracking-wider">
                        Emergency Email Notification
                      </h4>
                      <p className="text-neutral-500 text-[0.72rem] mt-0.5">
                        Dispatches incident summaries to designated security officers
                      </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={config.email_enabled}
                        onChange={(e) => setConfig((c) => ({ ...c, email_enabled: e.target.checked }))}
                        className="rounded text-[#C8102E] focus:ring-[#C8102E] cursor-pointer"
                      />
                      <span className="font-bold text-neutral-800 font-orbitron text-[0.65rem]">
                        {config.email_enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </label>
                  </div>

                  <input
                    type="email"
                    value={config.email_recipient || ''}
                    onChange={(e) => setConfig((c) => ({ ...c, email_recipient: e.target.value }))}
                    placeholder="security-ops@organization.com"
                    className="secure-input text-xs w-full"
                  />
                </div>

                {/* Severity Filter */}
                <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-between">
                  <div>
                    <h4 className="font-orbitron font-bold text-neutral-900 text-xs uppercase tracking-wider">
                      Minimum Alert Threshold
                    </h4>
                    <p className="text-neutral-500 text-[0.72rem]">
                      Only forward alerts meeting or exceeding this severity level
                    </p>
                  </div>
                  <select
                    value={config.min_severity}
                    onChange={(e) => setConfig((c) => ({ ...c, min_severity: e.target.value }))}
                    className="secure-input text-xs py-1.5 px-3 font-orbitron font-semibold uppercase"
                  >
                    <option value="INFO">INFO (All Events)</option>
                    <option value="WARNING">WARNING & Above</option>
                    <option value="HIGH">HIGH & CRITICAL</option>
                    <option value="CRITICAL">CRITICAL ONLY</option>
                  </select>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="btn-primary py-2.5 px-6 font-orbitron text-xs font-bold tracking-wider uppercase cursor-pointer"
                  >
                    SAVE NOTIFICATION CONFIG →
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between text-xs text-neutral-500 font-rajdhani">
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Sentinel Security Daemon Active
            </span>
            <button
              onClick={onClose}
              className="hover:text-neutral-900 transition-colors cursor-pointer font-semibold"
            >
              Close Center
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
