import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Settings,
  Save,
  Shield,
  Sliders,
  CheckCircle2,
  Clock,
  Radio,
  Wifi,
  Server
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const [settings, setSettings] = useState<{ [key: string]: { value: string; description: string } }>({});
  const [formData, setFormData] = useState<{ [key: string]: string }>({});
  const [nicStats, setNicStats] = useState<any | null>(null);
  const [selectedNic, setSelectedNic] = useState<string>('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    Promise.all([api.getSettings(), api.getInterfaceStats()]).then(([sData, nicData]) => {
      setSettings(sData);
      const initial: { [key: string]: string } = {};
      Object.keys(sData).forEach((k) => {
        initial[k] = sData[k].value;
      });
      setFormData(initial);
      setNicStats(nicData);
      setSelectedNic(nicData.interface || '');
      setIsLoading(false);
    });
  }, []);

  const handleNicChange = async (name: string) => {
    setSelectedNic(name);
    try {
      const data = await api.getInterfaceStats(name);
      setNicStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Administrator privileges required to modify global NOC parameters.');
      return;
    }

    try {
      const res = await api.updateSettings(formData);
      setSettings(res.settings);
      setSaveMessage('Settings successfully saved and persisted to SQLite!');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            System &amp; Network Threshold Configuration
          </h1>
          <p className="text-xs text-slate-400">
            Calibrate statistical detection sensitivity, background polling intervals, and hardware telemetry bindings.
          </p>
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/40 border border-amber-800/60 rounded text-amber-300 text-xs">
            <Shield className="w-3.5 h-3.5" />
            <span>Read-Only Mode (Logged in as {user?.role})</span>
          </div>
        )}
      </div>

      {saveMessage && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs rounded-md flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Local Network Interface Telemetry Binding */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wifi className="w-4 h-4 text-cyan-400" />
            Local Network Interface Throughput Binding (psutil / /proc/net/dev)
          </h2>
          <p className="text-[11px] text-slate-400">
            Throughput rate gauges measure this specific host's physical or virtual network interface controller.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Active Interface</label>
            <select
              value={selectedNic}
              onChange={(e) => handleNicChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono focus:outline-none focus:border-cyan-500"
            >
              {(nicStats?.available_interfaces || []).map((name: string) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-slate-950 rounded border border-slate-800/80 font-mono text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Bytes Received:</span>
              <span className="text-slate-200 tabular-nums">{nicStats?.bytes_recv?.toLocaleString()} bytes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Bytes Transmitted:</span>
              <span className="text-slate-200 tabular-nums">{nicStats?.bytes_sent?.toLocaleString()} bytes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Packets RX / TX:</span>
              <span className="text-slate-200 tabular-nums">{nicStats?.packets_recv} / {nicStats?.packets_sent}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Errors / Drops:</span>
              <span className="text-slate-200 tabular-nums">{nicStats?.errin} err / {nicStats?.dropin} drops</span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Configuration Form */}
      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          NOC Polling &amp; Anomaly Detection Thresholds
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Default Target Polling Interval (seconds)
            </label>
            <input
              type="number"
              disabled={!isAdmin}
              value={formData.default_interval_sec || '15'}
              onChange={(e) => setFormData({ ...formData, default_interval_sec: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">Recommended: 10 - 30 seconds</span>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Default Probe Timeout (seconds)
            </label>
            <input
              type="number"
              disabled={!isAdmin}
              value={formData.default_timeout_sec || '3'}
              onChange={(e) => setFormData({ ...formData, default_timeout_sec: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">Subprocess wait ceiling before timing out</span>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Default Warning Latency Threshold (ms)
            </label>
            <input
              type="number"
              step="5"
              disabled={!isAdmin}
              value={formData.latency_warning_ms || '150'}
              onChange={(e) => setFormData({ ...formData, latency_warning_ms: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">Triggers DEGRADED state &amp; Warning Alert</span>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Default Critical Latency Threshold (ms)
            </label>
            <input
              type="number"
              step="5"
              disabled={!isAdmin}
              value={formData.latency_critical_ms || '300'}
              onChange={(e) => setFormData({ ...formData, latency_critical_ms: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">Must be strictly greater than warning ceiling</span>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Packet Loss Alert Threshold (%)
            </label>
            <input
              type="number"
              step="0.5"
              disabled={!isAdmin}
              value={formData.packet_loss_critical_pct || '5.0'}
              onChange={(e) => setFormData({ ...formData, packet_loss_critical_pct: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">Drop rate considered an active network incident</span>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Rolling MAD Modified Z-Score Sensitivity
            </label>
            <input
              type="number"
              step="0.1"
              disabled={!isAdmin}
              value={formData.mad_outlier_threshold || '3.5'}
              onChange={(e) => setFormData({ ...formData, mad_outlier_threshold: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">Standard statistical outlier cutoff is 3.5</span>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Default Predictive Maintenance Horizon (minutes)
            </label>
            <input
              type="number"
              disabled={!isAdmin}
              value={formData.forecast_horizon_minutes || '30'}
              onChange={(e) => setFormData({ ...formData, forecast_horizon_minutes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">Time horizon for OLS trend regression</span>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Weekly Maintenance Window
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={formData.maintenance_window || '02:00-04:00 UTC'}
              onChange={(e) => setFormData({ ...formData, maintenance_window: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">Scheduled downtime period</span>
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Persist System Settings</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
