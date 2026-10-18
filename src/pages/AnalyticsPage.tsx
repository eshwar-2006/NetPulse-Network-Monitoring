import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { MonitoredTarget, NetworkMetric } from '../types';
import {
  BarChart3,
  Download,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowDownUp,
  Percent,
  Clock,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [targets, setTargets] = useState<MonitoredTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('all');
  const [selectedHours, setSelectedHours] = useState<number>(24);
  const [metrics, setMetrics] = useState<NetworkMetric[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAnalytics = async () => {
    try {
      const [targetList, metricsList] = await Promise.all([
        api.getTargets(),
        api.getMetrics(selectedTargetId === 'all' ? undefined : parseInt(selectedTargetId, 10), 1000)
      ]);
      setTargets(targetList);

      // Filter metrics by cutoff
      const cutoff = Date.now() - selectedHours * 3600 * 1000;
      const filtered = metricsList.filter(m => new Date(m.timestamp).getTime() >= cutoff);
      setMetrics(filtered);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedTargetId, selectedHours]);

  // Latency metrics calculations
  const latencies = metrics
    .filter(m => m.ping_latency_ms !== null && m.ping_latency_ms !== undefined)
    .map(m => m.ping_latency_ms as number)
    .sort((a, b) => a - b);

  const count = latencies.length;
  const avgLatency = count > 0 ? (latencies.reduce((a, b) => a + b, 0) / count).toFixed(2) : '—';
  const minLatency = count > 0 ? latencies[0].toFixed(2) : '—';
  const maxLatency = count > 0 ? latencies[count - 1].toFixed(2) : '—';

  // Percentiles: P50, P95, P99
  const getPercentile = (pct: number) => {
    if (count === 0) return '—';
    const index = Math.ceil((pct / 100) * count) - 1;
    return latencies[Math.max(0, Math.min(count - 1, index))].toFixed(2);
  };

  const p50 = getPercentile(50);
  const p95 = getPercentile(95);
  const p99 = getPercentile(99);

  // Packet Loss calculation
  const totalProbes = metrics.length;
  const avgPacketLoss = totalProbes > 0
    ? (metrics.reduce((a, b) => a + (b.packet_loss_pct || 0), 0) / totalProbes).toFixed(2)
    : '0.00';

  // Availability SLA calculation: reachable probes / total attempted probes
  const reachableCount = metrics.filter(m => m.is_reachable).length;
  const availabilityPct = totalProbes > 0 ? ((reachableCount / totalProbes) * 100).toFixed(2) : '100.00';

  // HTTP Metrics
  const httpMetrics = metrics.filter(m => m.http_status_code !== null);
  const httpSuccessCount = httpMetrics.filter(m => m.http_status_code && m.http_status_code >= 200 && m.http_status_code < 400).length;
  const httpSuccessRate = httpMetrics.length > 0 ? ((httpSuccessCount / httpMetrics.length) * 100).toFixed(1) : '—';

  const downloadMetricsCsv = () => {
    const url = api.getMetricsExportUrl(
      selectedHours,
      selectedTargetId === 'all' ? undefined : parseInt(selectedTargetId, 10)
    );
    window.location.href = url;
  };

  const downloadIncidentsCsv = () => {
    window.location.href = api.getIncidentsExportUrl();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            Performance Analytics &amp; SLA Reporting
          </h1>
          <p className="text-xs text-slate-400">
            Percentile distribution, SLA availability, packet drop rates, and CSV data exports.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedTargetId}
            onChange={(e) => setSelectedTargetId(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-md text-slate-200"
          >
            <option value="all">Fleet Aggregate (All Targets)</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-md text-xs">
            {[6, 24, 72, 168].map((h) => (
              <button
                key={h}
                onClick={() => setSelectedHours(h)}
                className={`px-2 py-1 rounded transition-colors ${
                  selectedHours === h
                    ? 'bg-slate-800 text-cyan-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {h === 168 ? '7d' : `${h}h`}
              </button>
            ))}
          </div>

          <button
            onClick={downloadMetricsCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors"
            title="Export filtered measurements to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Metrics CSV</span>
          </button>

          <button
            onClick={downloadIncidentsCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
            title="Export incidents tickets to CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
            <span>Incidents CSV</span>
          </button>
        </div>
      </div>

      {/* Latency Percentiles Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Latency Percentile Distribution
          </h2>
          <p className="text-[11px] text-slate-400">
            Calculated over {count} valid round-trip measurements in the selected window.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-center">
          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase font-sans">Min Latency</span>
            <span className="text-lg font-bold text-slate-200 tabular-nums">{minLatency}</span>
            <span className="text-[10px] text-slate-500 ml-0.5">ms</span>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase font-sans">Average Latency</span>
            <span className="text-lg font-bold text-cyan-400 tabular-nums">{avgLatency}</span>
            <span className="text-[10px] text-slate-500 ml-0.5">ms</span>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase font-sans">P50 (Median)</span>
            <span className="text-lg font-bold text-slate-200 tabular-nums">{p50}</span>
            <span className="text-[10px] text-slate-500 ml-0.5">ms</span>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase font-sans">P95 Latency</span>
            <span className="text-lg font-bold text-amber-400 tabular-nums">{p95}</span>
            <span className="text-[10px] text-slate-500 ml-0.5">ms</span>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase font-sans">P99 Latency</span>
            <span className="text-lg font-bold text-rose-400 tabular-nums">{p99}</span>
            <span className="text-[10px] text-slate-500 ml-0.5">ms</span>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase font-sans">Max Peak</span>
            <span className="text-lg font-bold text-slate-200 tabular-nums">{maxLatency}</span>
            <span className="text-[10px] text-slate-500 ml-0.5">ms</span>
          </div>
        </div>
      </div>

      {/* SLA & Reliability KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Availability SLA */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Availability SLA
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
              {availabilityPct}%
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, parseFloat(availabilityPct))}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Denominator: {reachableCount} successful probes out of {totalProbes} scheduled samples.
            Missing probes are not counted as successful.
          </p>
        </div>

        {/* Packet Drop Rate */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-amber-400" />
              Measured Packet Drop
            </span>
            <span className="text-xs font-mono font-bold text-amber-400 tabular-nums">
              {avgPacketLoss}%
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, parseFloat(avgPacketLoss) * 5)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Mean packet loss recorded across ICMP multi-probe burst tests (threshold: 5.0%).
          </p>
        </div>

        {/* HTTP Endpoint Health */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              HTTP Success Rate
            </span>
            <span className="text-xs font-mono font-bold text-blue-400 tabular-nums">
              {httpSuccessRate === '—' ? 'N/A' : `${httpSuccessRate}%`}
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all"
              style={{ width: `${httpSuccessRate === '—' ? 0 : Math.min(100, parseFloat(httpSuccessRate))}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Proportion of HTTP requests returning 2xx/3xx codes ({httpSuccessCount}/{httpMetrics.length} requests).
          </p>
        </div>
      </div>

      {/* CSV Exporter Details */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-semibold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
            Compliance &amp; Audit CSV Export Engine
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Exports raw SQLite telemetry with precise ISO 8601 timestamps, latency in ms, packet loss, and RFC 4180 escaping.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={downloadMetricsCsv}
            className="px-3 py-1.5 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
          >
            Download {selectedHours}h Telemetry CSV
          </button>
        </div>
      </div>
    </div>
  );
};
