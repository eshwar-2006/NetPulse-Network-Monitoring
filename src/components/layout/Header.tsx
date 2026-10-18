import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Activity, Shield, UserCheck, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onRefreshAll, isRefreshing }) => {
  const { user, switchUser, isAdmin } = useAuth();

  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <Activity className="w-4 h-4" />
        </div>
        <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
          NetPulse NOC
        </span>
      </div>

      {/* Zone 2: System Telemetry Breadcrumb info */}
      <div className="hidden md:flex items-center gap-6 text-xs text-slate-400 whitespace-nowrap">
        <span className="text-slate-300 font-medium">Autonomous Telemetry Engine</span>
        <span aria-hidden="true" className="text-slate-700">·</span>
        <span>Polling: <strong className="text-slate-300 font-mono">15s</strong></span>
        <span aria-hidden="true" className="text-slate-700">·</span>
        <span>Engine: <strong className="text-cyan-400 font-mono">ICMP + HTTP + PSUtil</strong></span>
      </div>

      {/* Zone 3: Actions & Role switcher */}
      <div className="flex items-center gap-3 shrink-0">
        {onRefreshAll && (
          <button
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-750 hover:text-white rounded-md transition-colors disabled:opacity-50"
            title="Trigger immediate refresh across all monitored targets"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">Poll Now</span>
          </button>
        )}

        {/* Demo Role Switcher */}
        <button
          onClick={() => switchUser(isAdmin ? 'TECHNICIAN' : 'ADMIN')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-md transition-colors"
          title={`Currently logged in as ${user?.role}. Click to switch role for testing.`}
        >
          {isAdmin ? <Shield className="w-3.5 h-3.5 text-amber-400" /> : <UserCheck className="w-3.5 h-3.5 text-blue-400" />}
          <span>{isAdmin ? 'Admin Mode' : 'Tech Mode'}</span>
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-800 text-xs">
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
            {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="hidden lg:block text-left">
            <div className="font-semibold text-slate-200 text-xs leading-none">{user?.username}</div>
            <div className="text-[10px] text-slate-400 capitalize">{user?.role?.toLowerCase()}</div>
          </div>
        </div>
      </div>
    </header>
  );
};
