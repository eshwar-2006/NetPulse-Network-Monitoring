import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Zap,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Flame,
  CheckSquare,
  Settings,
  Wifi
} from 'lucide-react';

interface SidebarProps {
  anomalyCount?: number;
  incidentCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ anomalyCount = 0, incidentCount = 0 }) => {
  const navItems = [
    { to: '/', label: 'NOC Dashboard', icon: LayoutDashboard },
    { to: '/targets', label: 'Monitored Targets', icon: Server },
    { to: '/probes', label: 'Live Diagnostics', icon: Zap },
    { to: '/anomalies', label: 'Anomalies', icon: AlertTriangle, badge: anomalyCount > 0 ? anomalyCount : null, badgeColor: 'bg-amber-500/20 text-amber-300' },
    { to: '/forecast', label: 'Predictive Horizon', icon: TrendingUp },
    { to: '/analytics', label: 'Analytics & SLA', icon: BarChart3 },
    { to: '/incidents', label: 'Incident Desk', icon: Flame, badge: incidentCount > 0 ? incidentCount : null, badgeColor: 'bg-rose-500/20 text-rose-300' },
    { to: '/operations', label: 'Tasks & Milestones', icon: CheckSquare },
    { to: '/settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 h-[calc(100vh-53px)] sticky top-[53px]">
      <div className="p-4 flex items-center gap-2 border-b border-slate-800/80">
        <Wifi className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">Operations Console</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && item.badge !== undefined && (
                <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* System Status Footnote */}
      <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-500 space-y-1">
        <div className="flex justify-between items-center text-slate-400 font-mono">
          <span>Engine Status</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
            ACTIVE
          </span>
        </div>
        <div className="text-[10px] text-slate-500">
          SQLite Persistent Engine · Port 3000
        </div>
      </div>
    </aside>
  );
};
