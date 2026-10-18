import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { MonitoredTarget } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Server,
  Plus,
  Play,
  Trash2,
  Edit2,
  RefreshCw,
  Power,
  PowerOff,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Loader2,
  ExternalLink
} from 'lucide-react';

export const TargetsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [targets, setTargets] = useState<MonitoredTarget[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [checkingId, setCheckingId] = useState<number | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTarget, setEditingTarget] = useState<MonitoredTarget | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    hostname: '',
    http_url: '',
    target_type: 'DUAL' as 'ICMP' | 'HTTP' | 'DUAL',
    interval_sec: 15,
    timeout_sec: 3,
    warning_threshold_ms: 150.0,
    critical_threshold_ms: 300.0,
  });

  const fetchTargets = async () => {
    try {
      const data = await api.getTargets();
      setTargets(data);
    } catch (err: any) {
      console.error('Failed to load targets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  const openAddModal = () => {
    setEditingTarget(null);
    setFormData({
      name: '',
      hostname: '',
      http_url: '',
      target_type: 'DUAL',
      interval_sec: 15,
      timeout_sec: 3,
      warning_threshold_ms: 150.0,
      critical_threshold_ms: 300.0,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (t: MonitoredTarget) => {
    setEditingTarget(t);
    setFormData({
      name: t.name,
      hostname: t.hostname,
      http_url: t.http_url || '',
      target_type: t.target_type,
      interval_sec: t.interval_sec,
      timeout_sec: t.timeout_sec,
      warning_threshold_ms: t.warning_threshold_ms,
      critical_threshold_ms: t.critical_threshold_ms,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Target Name is required.');
      return;
    }
    if (!formData.hostname.trim()) {
      setFormError('Hostname or IP Address is required.');
      return;
    }
    if (formData.critical_threshold_ms <= formData.warning_threshold_ms) {
      setFormError('Critical threshold must exceed warning threshold.');
      return;
    }

    try {
      if (editingTarget) {
        await api.updateTarget(editingTarget.id, formData);
      } else {
        await api.createTarget(formData);
      }
      setIsModalOpen(false);
      await fetchTargets();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete '${name}'? This will remove its historical measurements.`)) {
      return;
    }
    try {
      await api.deleteTarget(id);
      await fetchTargets();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleToggleMonitoring = async (id: number, currentEnabled: boolean) => {
    try {
      await api.toggleMonitoring(id, !currentEnabled);
      await fetchTargets();
    } catch (err: any) {
      alert(`Toggle failed: ${err.message}`);
    }
  };

  const handleCheckNow = async (id: number) => {
    setCheckingId(id);
    try {
      const res = await api.checkTargetNow(id);
      await fetchTargets();
      if (res.anomalies_detected && res.anomalies_detected.length > 0) {
        alert(`Check completed with ${res.anomalies_detected.length} anomalous event(s) detected!`);
      }
    } catch (err: any) {
      alert(`Check failed: ${err.message}`);
    } finally {
      setCheckingId(null);
    }
  };

  const filteredTargets = targets.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.hostname.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" />
            Monitored Targets Fleet
          </h1>
          <p className="text-xs text-slate-400">
            Configure hosts, ICMP/HTTP thresholds, polling intervals, and probe states.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search targets or IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />

          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Target</span>
          </button>
        </div>
      </div>

      {/* Target Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTargets.map((t) => {
          const isChecking = checkingId === t.id;

          let statusColor = 'text-slate-400 border-slate-700 bg-slate-800';
          let StatusIcon = HelpCircle;
          if (t.status === 'UP') {
            statusColor = 'text-emerald-400 border-emerald-800/60 bg-emerald-950/40';
            StatusIcon = CheckCircle2;
          } else if (t.status === 'DEGRADED') {
            statusColor = 'text-amber-400 border-amber-800/60 bg-amber-950/40';
            StatusIcon = AlertTriangle;
          } else if (t.status === 'DOWN') {
            statusColor = 'text-rose-400 border-rose-800/60 bg-rose-950/40';
            StatusIcon = XCircle;
          } else if (t.status === 'CHECKING') {
            statusColor = 'text-blue-400 border-blue-800/60 bg-blue-950/40';
            StatusIcon = Loader2;
          }

          return (
            <div
              key={t.id}
              className={`bg-slate-900 border rounded-lg p-4 flex flex-col justify-between transition-colors ${
                t.is_enabled ? 'border-slate-800' : 'border-slate-800/60 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-semibold text-sm text-white">{t.name}</h3>
                    <div className="text-xs font-mono text-cyan-400 flex items-center gap-1 mt-0.5">
                      <span>{t.hostname}</span>
                      {t.http_url && (
                        <a
                          href={t.http_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-500 hover:text-slate-300"
                          title="Open HTTP Endpoint"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${statusColor}`}>
                    <StatusIcon className={`w-3 h-3 ${t.status === 'CHECKING' ? 'animate-spin' : ''}`} />
                    {t.status}
                  </span>
                </div>

                {/* Metrics Summary Strip */}
                <div className="grid grid-cols-2 gap-2 my-3 p-2.5 bg-slate-950/60 rounded border border-slate-800/80 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Ping Latency</span>
                    <span className="font-mono font-medium text-slate-200 tabular-nums">
                      {t.last_latency_ms !== null && t.last_latency_ms !== undefined ? `${t.last_latency_ms} ms` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Packet Loss</span>
                    <span className={`font-mono font-medium tabular-nums ${
                      (t.last_packet_loss || 0) > 0 ? 'text-amber-400' : 'text-slate-200'
                    }`}>
                      {t.last_packet_loss !== null && t.last_packet_loss !== undefined ? `${t.last_packet_loss}%` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Warning / Crit</span>
                    <span className="font-mono text-slate-400 text-[11px]">
                      {t.warning_threshold_ms} / {t.critical_threshold_ms} ms
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Poll Interval</span>
                    <span className="font-mono text-slate-400 text-[11px]">
                      Every {t.interval_sec}s
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 mb-3 flex items-center justify-between">
                  <span>Method: <strong className="text-slate-400">{t.target_type}</strong></span>
                  <span>Checked: {t.last_check_time ? new Date(t.last_check_time).toLocaleTimeString() : 'Never'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCheckNow(t.id)}
                    disabled={isChecking}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40 border border-cyan-800/40 rounded transition-colors disabled:opacity-50"
                  >
                    <Play className="w-3 h-3" />
                    <span>{isChecking ? 'Probing...' : 'Check'}</span>
                  </button>

                  <button
                    onClick={() => handleToggleMonitoring(t.id, t.is_enabled)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded transition-colors ${
                      t.is_enabled
                        ? 'text-emerald-400 hover:bg-emerald-950/40 border-emerald-800/40'
                        : 'text-slate-400 hover:bg-slate-800 border-slate-700'
                    }`}
                    title={t.is_enabled ? 'Disable Background Polling' : 'Enable Background Polling'}
                  >
                    {t.is_enabled ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                    <span>{t.is_enabled ? 'Active' : 'Paused'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(t)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                    title="Edit Target"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(t.id, t.name)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition-colors"
                      title="Delete Target (Admin Only)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTargets.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-lg">
          <Server className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-white">No targets found</h3>
          <p className="text-xs text-slate-400 mt-1 mb-4">Add your first host or IP address to start real-time monitoring.</p>
          <button
            onClick={openAddModal}
            className="px-4 py-2 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-md"
          >
            Add Target Now
          </button>
        </div>
      )}

      {/* Target Modal (Add / Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">
                {editingTarget ? 'Edit Monitoring Target' : 'Register Monitored Target'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-md">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cloudflare Edge DNS"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Hostname or IP *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1.1.1.1 or google.com"
                    value={formData.hostname}
                    onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Target Type</label>
                  <select
                    value={formData.target_type}
                    onChange={(e) => setFormData({ ...formData, target_type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="DUAL">DUAL (ICMP Ping + HTTP)</option>
                    <option value="ICMP">ICMP Ping Only</option>
                    <option value="HTTP">HTTP/HTTPS Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">HTTP / HTTPS URL (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. https://1.1.1.1"
                  value={formData.http_url}
                  onChange={(e) => setFormData({ ...formData, http_url: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Poll Interval (seconds)</label>
                  <input
                    type="number"
                    min="5"
                    max="3600"
                    value={formData.interval_sec}
                    onChange={(e) => setFormData({ ...formData, interval_sec: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Probe Timeout (seconds)</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={formData.timeout_sec}
                    onChange={(e) => setFormData({ ...formData, timeout_sec: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Warning Latency (ms)</label>
                  <input
                    type="number"
                    step="5"
                    value={formData.warning_threshold_ms}
                    onChange={(e) => setFormData({ ...formData, warning_threshold_ms: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Critical Latency (ms)</label>
                  <input
                    type="number"
                    step="5"
                    value={formData.critical_threshold_ms}
                    onChange={(e) => setFormData({ ...formData, critical_threshold_ms: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors"
                >
                  {editingTarget ? 'Save Changes' : 'Create Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
