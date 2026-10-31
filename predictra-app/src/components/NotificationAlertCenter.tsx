import React, { useState, useEffect } from 'react';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  triggerTestEmail,
  type NotificationItem,
} from '../services/api';

export const NotificationAlertCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  const [testEmailModal, setTestEmailModal] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);

  const loadNotifications = () => {
    setLoading(true);
    fetchNotifications(filterUnread)
      .then((res) => {
        setNotifications(res.notifications);
        setUnreadCount(res.total_unread);
      })
      .catch((err) => console.error('Failed fetching notifications:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadNotifications();
  }, [filterUnread]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      loadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      loadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingEmail(true);
    setEmailStatusMsg(null);
    try {
      const res = await triggerTestEmail(testEmailRecipient || undefined, 'FDR-2026-TEST-7719', 'CRITICAL');
      setEmailStatusMsg(`Test SMTP alert dispatched! Subject: ${res.subject}`);
      setTimeout(() => {
        setTestEmailModal(false);
        setEmailStatusMsg(null);
        loadNotifications();
      }, 2500);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'SMTP dispatch error');
    } finally {
      setSendingEmail(false);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'HIGH':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs p-5 px-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="telemetry-pill bg-[#8B1E2D]/10 text-[#8B1E2D] border border-[#8B1E2D]/20">
                PHASE 6 ALERT INTELLIGENCE
              </span>
              <span className="telemetry-pill bg-slate-100 text-[#667085] border border-[#E4E7EC]">
                ENTERPRISE NOTIFICATION CENTER
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#20242C] tracking-tight">
              Incident Alerts &amp; Email Dispatch
            </h1>
            <p className="text-xs text-[#667085] font-medium mt-1">
              Real-time multi-channel notifications with automated SMTP escalation on critical anomalies.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTestEmailModal(true)}
              className="px-4 py-2 bg-[#8B1E2D] hover:bg-[#6F1724] text-white text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              Trigger Test SMTP Alert
            </button>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-[#20242C] text-xs font-semibold rounded-xl border border-[#E4E7EC] transition-colors cursor-pointer"
              >
                Mark All Read ({unreadCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#E4E7EC] bg-slate-50/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFilterUnread(false)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                !filterUnread ? 'bg-white shadow-2xs text-[#20242C] border border-[#E4E7EC]' : 'text-[#667085] hover:text-[#20242C]'
              }`}
            >
              All Alerts ({notifications.length})
            </button>
            <button
              onClick={() => setFilterUnread(true)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filterUnread ? 'bg-white shadow-2xs text-[#20242C] border border-[#E4E7EC]' : 'text-[#667085] hover:text-[#20242C]'
              }`}
            >
              Unread Only ({unreadCount})
            </button>
          </div>
        </div>

        <div className="divide-y divide-[#E4E7EC]">
          {loading ? (
            <div className="py-16 text-center text-[#667085] font-mono text-xs">
              Loading incident notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center text-[#667085]">
              <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-[#667085] font-bold text-sm mb-2">
                ✓
              </div>
              <p className="text-xs font-semibold text-[#20242C]">No active notifications in this view.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                  !n.is_read ? 'bg-[#8B1E2D]/5' : 'hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-sm border mt-0.5 ${getSeverityBadge(n.severity)}`}>
                    {n.severity}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-[#20242C] flex items-center gap-2">
                      <span>{n.title}</span>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[#8B1E2D] inline-block" />
                      )}
                    </h4>
                    <p className="text-xs text-[#667085] mt-1 leading-relaxed">{n.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-[#667085]">
                      <span>Category: {n.category}</span>
                      {n.fdr_ref && <span>Ref: <strong className="text-[#20242C]">{n.fdr_ref}</strong></span>}
                      {n.created_at && <span>{new Date(n.created_at).toLocaleString()}</span>}
                    </div>
                  </div>
                </div>

                {!n.is_read && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="text-xs text-[#667085] hover:text-[#20242C] font-semibold whitespace-nowrap px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg border border-[#E4E7EC] cursor-pointer"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Test Email Modal — Standardized Enterprise Box */}
      {testEmailModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-[#E4E7EC] w-full max-w-[640px] lg:max-w-[680px] px-8 sm:px-12 md:px-14 py-7 sm:py-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 font-orbitron">
                Trigger SMTP Security Incident Dispatch
              </h3>
              <button
                onClick={() => setTestEmailModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold text-xl transition-colors cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Sends an executive branded security incident email formatted with Deep Crimson styling, FDR metrics, and recommended compliance actions.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-mono">
                Recipient Email Address (Optional Override)
              </label>
              <input
                type="email"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                placeholder="Leave blank for ALERT_RECIPIENTS from .env"
                className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl p-3 font-sans focus:outline-hidden focus:ring-2 focus:ring-[#8B1E2D]"
              />
            </div>

            {emailStatusMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
                {emailStatusMsg}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setTestEmailModal(false)}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={sendingEmail}
                onClick={handleSendTestEmail}
                className="px-5 py-2.5 text-xs font-bold bg-[#8B1E2D] hover:bg-[#6F1724] text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {sendingEmail ? 'Dispatching...' : 'Send Test Alert Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
