import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { DashboardSummary, MonitoredTarget } from '../types';
import {
  Server,
  CheckCircle2,
  AlertOctagon,
  Clock,
  Activity,
  ArrowDownUp,
  AlertTriangle,
  Flame,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [targets, setTargets] = useState<MonitoredTarget[]>([]);
  const [timeseriesData, setTimeseriesData] = useState<any[]>([]);
  const [anomaliesData, setAnomaliesData] = useState<any[]>([]);
  const [selectedHours, setSelectedHours] = useState<number>(6);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [checkingTargetId, setCheckingTargetId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [sumRes, targetsRes, tsRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getTargets(),
        api.getDashboardTimeseries(
          selectedHours,
          selectedTargetId === 'all' ? undefined : parseInt(selectedTargetId, 10)
        )
      ]);
      setSummary(sumRes);
      setTargets(targetsRes);
      setTimeseriesData(tsRes.series);
      setAnomaliesData(tsRes.anomalies);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10s auto refresh
    return () => clearInterval(interval);
  }, [selectedHours, selectedTargetId]);

  const handleManualCheck = async (targetId: number) => {
    setCheckingTargetId(targetId);
    try {
      await api.checkTargetNow(targetId);
      await fetchData();
    } catch (e: any) {
      alert(`Manual probe failed: ${e.message}`);
    } finally {
      setCheckingTargetId(null);
    }
  };

  // Format timestamp for chart x-axis
  const formatTime = (isoStr: string) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group metrics by timestamp for multi-target line chart
  const formattedLatencyData = timeseriesData.map((d) => ({
    time: formatTime(d.timestamp),
    rawTime: d.timestamp,
    target: d.target_name,
    latency: d.ping_latency_ms !== null ? d.ping_latency_ms : null,
    packetLoss: d.packet_loss_pct,
    httpTime: d.http_response_time_ms !== null ? d.http_response_time_ms : null,
    reachable: d.is_reachable ? 100 : 0
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title & Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Network Operations Center
          </h1>
          <p className="text-xs text-slate-400">
            Real-time latency, reachability telemetry, and statistical anomaly monitoring.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Target Filter */}
          <select
            value={selectedTargetId}
            onChange={(e) => setSelectedTargetId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Monitored Targets</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.hostname})
              </option>
            ))}
          </select>

          {/* Time range selector */}
          <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-md">
            {[1, 6, 24].map((h) => (
              <button
                key={h}
                onClick={() => setSelectedHours(h)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  selectedHours === h
                    ? 'bg-slate-800 text-cyan-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {h}h
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchData()}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-md"
            title="Refresh Metrics"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Targets */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Monitored Targets</span>
            <Server className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {summary?.total_targets ?? '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="text-emerald-400 font-medium">{summary?.reachable_targets ?? 0} UP</span>
            <span>·</span>
            <span className="text-amber-400 font-medium">{summary?.degraded_targets ?? 0} DEGRADED</span>
          </div>
        </div>

        {/* Average Latency */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Average Latency</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400 tabular-nums">
            {summary?.avg_latency_ms !== null && summary?.avg_latency_ms !== undefined
              ? `${summary.avg_latency_ms} ms`
              : 'No data'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Measured across recent ICMP probes
          </div>
        </div>

        {/* Packet Loss */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Packet Loss</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className={`text-2xl font-bold font-mono tabular-nums ${
            (summary?.avg_packet_loss_pct || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {summary?.avg_packet_loss_pct !== undefined ? `${summary.avg_packet_loss_pct}%` : '0.0%'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {summary?.failing_targets ? `${summary.failing_targets} host unreachable` : 'All links receiving packets'}
          </div>
        </div>

        {/* Local Network Throughput */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Local Interface Rate</span>
            <ArrowDownUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums flex items-baseline gap-2">
            <span className="text-emerald-400 text-lg">↓ {summary?.local_throughput?.rx_rate_kbps ?? 0}</span>
            <span className="text-blue-400 text-lg">↑ {summary?.local_throughput?.tx_rate_kbps ?? 0}</span>
            <span className="text-xs font-normal text-slate-400">KB/s</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">
            NIC: {summary?.local_throughput?.interface ?? 'eth0'} (host system)
          </div>
        </div>
      </div>

      {/* KPI Cards Secondary Strip: Active Anomalies & Open Incidents */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/anomalies"
          className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 rounded-lg p-3.5 flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-300">Active Unresolved Anomalies</div>
              <div className="text-xs text-slate-500">Calculated via Rolling MAD &amp; Threshold checks</div>
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
            {summary?.active_anomalies ?? 0}
          </div>
        </Link>

        <Link
          to="/incidents"
          className="bg-slate-900/80 border border-slate-800 hover:border-rose-500/40 rounded-lg p-3.5 flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-300">Open Incidents</div>
              <div className="text-xs text-slate-500">Active operational tickets pending resolution</div>
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
            {summary?.open_incidents ?? 0}
          </div>
        </Link>
      </div>

      {/* Charts Section: 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Latency Over Time */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Ping Latency Trend</h2>
              <p className="text-[11px] text-slate-400">Round-trip time in milliseconds (ms)</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">{selectedHours}h window</span>
          </div>

          <div className="h-64 w-full">
            {formattedLatencyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedLatencyData}>
                  <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="ms" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                    formatter={(val: any) => [`${val} ms`, 'Latency']}
                  />
                  <Area type="monotone" dataKey="latency" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#latencyGradient)" name="Latency (ms)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No latency telemetry points recorded yet
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Packet Loss Over Time */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Packet Loss Percentage</h2>
              <p className="text-[11px] text-slate-400">Probe drops over transmission window (%)</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Threshold: 5%</span>
          </div>

          <div className="h-64 w-full">
            {formattedLatencyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formattedLatencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                    formatter={(val: any) => [`${val}%`, 'Packet Loss']}
                  />
                  <Bar dataKey="packetLoss" fill="#f59e0b" name="Loss %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No packet loss events
              </div>
            )}
          </div>
        </div>

        {/* Chart 3: HTTP Response Time */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">HTTP / HTTPS Response Time</h2>
              <p className="text-[11px] text-slate-400">Application layer response time (ms)</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {formattedLatencyData.filter(d => d.httpTime !== null).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedLatencyData.filter(d => d.httpTime !== null)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="ms" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                    formatter={(val: any) => [`${val} ms`, 'HTTP Elapsed']}
                  />
                  <Line type="monotone" dataKey="httpTime" stroke="#3b82f6" strokeWidth={2} dot={false} name="HTTP Time (ms)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No HTTP target measurements available in this window
              </div>
            )}
          </div>
        </div>

        {/* Chart 4: Availability SLA Trend */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Reachability / Availability SLA</h2>
              <p className="text-[11px] text-slate-400">100% reachable vs 0% dropped probes</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {formattedLatencyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedLatencyData}>
                  <defs>
                    <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                    formatter={(val: any) => [`${val}%`, 'Reachable']}
                  />
                  <Area type="stepAfter" dataKey="reachable" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#reachGradient)" name="Availability %" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No reachability history yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Target Quick Status Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Monitored Target Fleet Status</h2>
            <p className="text-[11px] text-slate-400">Real-time status based on last collected probe</p>
          </div>
          <Link
            to="/targets"
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
          >
            Manage Fleet <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="px-4 py-3">Target Name</th>
                <th className="px-4 py-3">Host / URL</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ping Latency</th>
                <th className="px-4 py-3 text-right">Packet Loss</th>
                <th className="px-4 py-3">Last Check</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {targets.map((t) => {
                const isChecking = checkingTargetId === t.id;
                let statusBadge = 'bg-slate-800 text-slate-300 border-slate-700';
                if (t.status === 'UP') statusBadge = 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60';
                if (t.status === 'DEGRADED') statusBadge = 'bg-amber-950/50 text-amber-400 border-amber-800/60';
                if (t.status === 'DOWN') statusBadge = 'bg-rose-950/50 text-rose-400 border-rose-800/60';
                if (t.status === 'CHECKING') statusBadge = 'bg-blue-950/50 text-blue-400 border-blue-800/60';

                return (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{t.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{t.hostname}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                        {t.target_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${statusBadge}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                      {t.last_latency_ms !== null && t.last_latency_ms !== undefined ? `${t.last_latency_ms} ms` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {t.last_packet_loss !== null && t.last_packet_loss !== undefined ? `${t.last_packet_loss}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {t.last_check_time ? new Date(t.last_check_time).toLocaleTimeString() : 'Pending'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleManualCheck(t.id)}
                        disabled={isChecking}
                        className="px-2.5 py-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40 border border-cyan-800/40 rounded transition-colors disabled:opacity-50"
                      >
                        {isChecking ? 'Checking...' : 'Check Now'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
