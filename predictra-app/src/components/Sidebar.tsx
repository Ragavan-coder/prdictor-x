import type { User } from '../App';

export type NavigationTab =
  | 'dashboard'
  | 'records'
  | 'upload'
  | 'reading'
  | 'verification'
  | 'ai-guardian'
  | 'duplicates'
  | 'risk'
  | 'alerts'
  | 'lifecycle'
  | 'audit'
  | 'settings';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  user: User;
  onLogout: () => void;
}

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: string;
  badge?: string;
  isPlanned?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'records', label: 'FDR Records', icon: '📑' },
  { id: 'upload', label: 'Upload Documents', icon: '📤' },
  { id: 'reading', label: 'Universal Reading', icon: '👁️' },
  { id: 'verification', label: 'SENTRA Verification', icon: '🛡️' },
  { id: 'ai-guardian', label: 'AI Guardian', icon: '⚡' },
  { id: 'duplicates', label: 'Duplicate Intelligence', icon: '🧬' },
  { id: 'risk', label: 'Risk Intelligence', icon: '⚖️' },
  { id: 'alerts', label: 'Alert Center', icon: '🔔' },
  { id: 'lifecycle', label: 'Lifecycle Monitoring', icon: '⏳' },
  { id: 'audit', label: 'Audit & Evidence', icon: '🔒' },
  { id: 'settings', label: 'Settings', icon: '⚙️', badge: 'PLANNED', isPlanned: true },
];

export default function Sidebar({ currentTab, onSelectTab, user, onLogout }: SidebarProps) {
  return (
    <aside
      className="flex-shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between h-full select-none z-30"
      style={{ width: 'clamp(13rem, 17vw, 17rem)' }}
    >
      {/* 1. Brand Header */}
      <div className="p-4 px-5 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B1E2D] via-[#A00D24] to-[#6F1724] flex items-center justify-center text-white font-black text-sm tracking-wider shadow-md shadow-[#8B1E2D]/20 flex-shrink-0">
          PX
        </div>
        <div className="min-w-0">
          <h1 className="font-extrabold text-slate-900 tracking-wider font-orbitron flex items-center gap-1.5 truncate" style={{ fontSize: '0.75rem' }}>
            PREDICTRA-X
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          </h1>
          <p className="text-slate-400 font-mono tracking-widest uppercase truncate" style={{ fontSize: '0.65rem' }}>
            SENTRA AI CORE
          </p>
        </div>
      </div>

      {/* 2. Scrollable Navigation Section */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 min-h-0">
        <div className="px-2 pt-1 pb-2 flex items-center justify-between">
          <span className="font-bold text-slate-400 tracking-wider uppercase" style={{ fontSize: '0.68rem' }}>
            Navigation
          </span>
          <span className="font-mono text-slate-400" style={{ fontSize: '0.65rem' }}>v1.4</span>
        </div>

        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!item.isPlanned) {
                    onSelectTab(item.id);
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white font-semibold shadow-sm shadow-slate-900/10'
                    : item.isPlanned
                    ? 'text-slate-400 cursor-not-allowed opacity-60 hover:bg-slate-50/50'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                style={{ fontSize: '0.82rem' }}
                title={item.isPlanned ? 'Feature planned for upcoming milestone' : item.label}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base flex-shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge ? (
                  <span
                    className={`font-mono px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                      isActive
                        ? 'bg-slate-800 text-slate-300 border border-slate-700'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                    style={{ fontSize: '0.62rem' }}
                  >
                    {item.badge}
                  </span>
                ) : isActive ? (
                  <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50 flex-shrink-0" />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. User Footer Profile */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 mb-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold shadow-xs flex-shrink-0" style={{ fontSize: '0.85rem' }}>
            {user.name ? user.name[0].toUpperCase() : 'A'}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate" style={{ fontSize: '0.82rem' }}>
              {user.name || user.email || 'Sentra Admin'}
            </p>
            <p className="text-slate-500 font-mono truncate" style={{ fontSize: '0.7rem' }}>
              {user.email || 'admin@predictra.x'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/80">
          <span className="font-mono px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/90 flex items-center gap-1.5 font-bold shadow-2xs" style={{ fontSize: '0.68rem' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            MFA VERIFIED
          </span>

          <button
            onClick={onLogout}
            className="text-rose-600 hover:text-rose-800 font-semibold transition-colors flex items-center gap-1"
            style={{ fontSize: '0.82rem' }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
