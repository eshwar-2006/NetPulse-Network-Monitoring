import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Anomaly, MonitoredTarget } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  Filter,
  Check,
  Flame,
  FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AnomaliesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [targets, setTargets] = useState<MonitoredTarget[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterResolved, setFilterResolved] = useState<string>('unresolved');
  const [filterTarget, setFilterTarget] = useState<string>('all');

  // Resolution modal state
  const [resolvingAnomaly, setResolvingAnomaly] = useState<Anomaly | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  const fetchAnomalies = async () => {
    try {
      const [anomRes, targetsRes] = await Promise.all([
        api.getAnomalies({
          severity: filterSeverity === 'all' ? undefined : filterSeverity,
          resolved: filterResolved === 'all' ? undefined : filterResolved === 'resolved',
          target_id: filterTarget === 'all' ? undefined : parseInt(filterTarget, 10)
        }),
        api.getTargets()
      ]);
      setAnomalies(anomRes);
      setTargets(targetsRes);
    } catch (err) {
      console.error('Error fetching anomalies:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
    const interval = setInterval(fetchAnomalies, 15000);
    return () => clearInterval(interval);
  }, [filterSeverity, filterResolved, filterTarget]);

  const handleAcknowledge = async (id: number) => {
    try {
      await api.acknowledgeAnomaly(id);
      await fetchAnomalies();
    } catch (err: any) {
      alert(`Acknowledgement failed: ${err.message}`);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingAnomaly) return;

    try {
      await api.resolveAnomaly(resolvingAnomaly.id, resolutionNotes);
      setResolvingAnomaly(null);
      setResolutionNotes('');
      await fetchAnomalies();
    } catch (err: any) {
      alert(`Resolution failed: ${err.message}`);
    }
  };

  const handleEscalateToIncident = (a: Anomaly) => {
    navigate('/incidents', {
      state: {
        newIncident: {
          title: `[Anomaly Alert] ${a.detection_method} on ${a.target_name}`,
          description: `${a.explanation}\nObserved Value: ${a.observed_value}\nThreshold: ${a.threshold_value}`,
          target_id: a.target_id,
          anomaly_id: a.id,
          severity: a.severity
        }
      }
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Statistical Anomaly Detection &amp; Alert Engine
          </h1>
          <p className="text-xs text-slate-400">
            Explainable non-parametric outliers calculated via Rolling Median Absolute Deviation (MAD), static ceilings, and consecutive probe drops.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Target */}
          <select
            value={filterTarget}
            onChange={(e) => setFilterTarget(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded-md text-slate-200"
          >
            <option value="all">All Targets</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Severity */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded-md text-slate-200"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          {/* Resolution Status */}
          <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-md text-xs">
            {['unresolved', 'resolved', 'all'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterResolved(st)}
                className={`px-2.5 py-1 rounded capitalize transition-colors ${
                  filterResolved === st
                    ? 'bg-slate-800 text-cyan-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Detection Methodology Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3.5 text-xs text-slate-400 flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-slate-200">Non-Parametric Statistical Methodology:</span>
          <p>
            Anomalies are detected using exact Rolling Median Absolute Deviation (MAD), where Modified Z-Score{' '}
            <code className="text-cyan-300 font-mono">M = 0.6745 * (x - median) / MAD &gt; 3.5</code>.
            This avoids bias from sudden skewness in network latency and prevents false alarm floods.
          </p>
        </div>
      </div>

      {/* Anomalies List */}
      <div className="space-y-3">
        {anomalies.map((a) => {
          let sevBadge = 'text-slate-400 border-slate-700 bg-slate-800';
          if (a.severity === 'CRITICAL') sevBadge = 'text-rose-400 border-rose-800/80 bg-rose-950/60';
          if (a.severity === 'HIGH') sevBadge = 'text-orange-400 border-orange-800/80 bg-orange-950/60';
          if (a.severity === 'WARNING') sevBadge = 'text-amber-400 border-amber-800/80 bg-amber-950/60';
          if (a.severity === 'INFO') sevBadge = 'text-blue-400 border-blue-800/80 bg-blue-950/60';

          return (
            <div
              key={a.id}
              className={`bg-slate-900 border rounded-lg p-4 transition-colors ${
                a.is_resolved ? 'border-slate-800/60 opacity-70' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border font-mono ${sevBadge}`}>
                      {a.severity}
                    </span>

                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-400 font-semibold">
                      {a.detection_method}
                    </span>

                    <span className="font-semibold text-sm text-white">
                      {a.target_name || `Target #${a.target_id}`}
                    </span>

                    <span className="text-slate-500 text-xs flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {new Date(a.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {a.explanation}
                  </p>

                  {/* Quantitative Baseline / Observed Comparison */}
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-1 text-slate-400">
                    {a.observed_value !== null && a.observed_value !== undefined && (
                      <div>
                        Observed: <strong className="text-white tabular-nums">{a.observed_value}</strong>
                      </div>
                    )}
                    {a.baseline_value !== null && a.baseline_value !== undefined && (
                      <div>
                        Baseline: <span className="text-slate-300 tabular-nums">{a.baseline_value}</span>
                      </div>
                    )}
                    {a.threshold_value !== null && a.threshold_value !== undefined && (
                      <div>
                        Threshold: <span className="text-amber-400 tabular-nums">{a.threshold_value}</span>
                      </div>
                    )}
                  </div>

                  {a.notes && (
                    <div className="mt-2 p-2 bg-slate-950/60 border border-slate-800 rounded text-xs text-slate-400 whitespace-pre-wrap">
                      <strong className="text-slate-300">Investigation Notes:</strong> {a.notes}
                    </div>
                  )}
                </div>

                {/* Status and Action Buttons */}
                <div className="flex md:flex-col items-end justify-between md:justify-start gap-2 shrink-0 pt-2 md:pt-0">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    {a.is_resolved ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> RESOLVED
                      </span>
                    ) : a.is_acknowledged ? (
                      <span className="text-blue-400 flex items-center gap-1 font-mono text-[11px]">
                        <Check className="w-3.5 h-3.5" /> ACKNOWLEDGED
                      </span>
                    ) : (
                      <span className="text-amber-400 font-mono text-[11px] animate-pulse">
                        ● UNACKNOWLEDGED
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!a.is_acknowledged && !a.is_resolved && (
                      <button
                        onClick={() => handleAcknowledge(a.id)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}

                    {!a.is_resolved && (
                      <button
                        onClick={() => setResolvingAnomaly(a)}
                        className="px-2.5 py-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/50 rounded transition-colors"
                      >
                        Resolve
                      </button>
                    )}

                    <button
                      onClick={() => handleEscalateToIncident(a)}
                      className="px-2.5 py-1 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 rounded transition-colors flex items-center gap-1"
                      title="Open Incident ticket for this anomaly"
                    >
                      <Flame className="w-3 h-3" />
                      <span>Escalate</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {anomalies.length === 0 && !isLoading && (
          <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-lg">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-white">Nominal Network State</h3>
            <p className="text-xs text-slate-400 mt-1">
              No anomalies matching the current filter criteria. All monitored probe series are behaving within calibrated statistical baselines.
            </p>
          </div>
        )}
      </div>

      {/* Resolution Notes Modal */}
      {resolvingAnomaly && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">
                Resolve Anomaly #{resolvingAnomaly.id}
              </h2>
              <button
                onClick={() => setResolvingAnomaly(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Target: <strong className="text-white">{resolvingAnomaly.target_name}</strong>
              <br />
              Method: <strong className="text-cyan-400">{resolvingAnomaly.detection_method}</strong>
            </p>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Technician Resolution &amp; Root Cause Notes
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Transient upstream BGP route flap resolved; ping latency returned to 12ms baseline."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingAnomaly(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md"
                >
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
