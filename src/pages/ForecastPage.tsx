import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { MonitoredTarget, ForecastResult } from '../types';
import {
  TrendingUp,
  AlertTriangle,
  Info,
  Clock,
  Sparkles,
  BarChart2,
  CheckCircle2,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from 'recharts';

export const ForecastPage: React.FC = () => {
  const [targets, setTargets] = useState<MonitoredTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [horizonMinutes, setHorizonMinutes] = useState<number>(30);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    api.getTargets().then((data) => {
      setTargets(data);
      if (data.length > 0) {
        setSelectedTargetId(data[0].id);
      }
    });
  }, []);

  const handleGenerate = async (targetId?: number, horizon?: number) => {
    const tId = targetId || selectedTargetId;
    const h = horizon || horizonMinutes;
    if (!tId) return;

    setIsGenerating(true);
    setErrorMsg(null);
    setForecast(null);

    try {
      const res = await api.generateForecast(tId, h);
      setForecast(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Forecast computation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (selectedTargetId) {
      handleGenerate(selectedTargetId, horizonMinutes);
    }
  }, [selectedTargetId, horizonMinutes]);

  // Combine historical points and forecast points into continuous chart timeline
  const combinedChartData: any[] = [];
  if (forecast?.historical_points) {
    forecast.historical_points.forEach((p) => {
      combinedChartData.push({
        time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        historyLatency: p.latency_ms,
        forecastLatency: null,
        type: 'historical'
      });
    });

    // Anchor: connect last historical point with first forecast point
    if (forecast.historical_points.length > 0 && forecast.forecast_points && forecast.forecast_points.length > 0) {
      const lastHist = forecast.historical_points[forecast.historical_points.length - 1];
      combinedChartData.push({
        time: new Date(lastHist.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        historyLatency: lastHist.latency_ms,
        forecastLatency: lastHist.latency_ms,
        type: 'anchor'
      });
    }

    if (forecast.forecast_points) {
      forecast.forecast_points.forEach((p) => {
        combinedChartData.push({
          time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          historyLatency: null,
          forecastLatency: p.predicted_latency_ms,
          type: 'forecast'
        });
      });
    }
  }

  const selectedTarget = targets.find((t) => t.id === selectedTargetId);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            Predictive Maintenance: Latency Trend Forecasting
          </h1>
          <p className="text-xs text-slate-400">
            Explainable Ordinary Least Squares (OLS) time-series forecasting projecting latency drifts and degradation risks.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <select
            value={selectedTargetId || ''}
            onChange={(e) => setSelectedTargetId(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.hostname})
              </option>
            ))}
          </select>

          <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-md text-xs">
            {[15, 30, 60, 120].map((mins) => (
              <button
                key={mins}
                onClick={() => setHorizonMinutes(mins)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  horizonMinutes === mins
                    ? 'bg-slate-800 text-cyan-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                +{mins}m
              </button>
            ))}
          </div>

          <button
            onClick={() => handleGenerate()}
            disabled={isGenerating}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-md disabled:opacity-50"
            title="Recalculate Trend Model"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Model Transparency Disclaimer Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3.5 text-xs text-slate-400 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">Statistical Transparency &amp; Rigor:</span>
          <p className="mt-0.5">
            This module uses mathematical OLS linear regression (<code className="text-cyan-300 font-mono">y = mx + c</code>)
            directly on verified SQLite historical measurements. Predictions are marked as <strong>statistical estimates</strong>,
            never guarantees or artificial intelligence fabrications.
          </p>
        </div>
      </div>

      {/* Error / Insufficient Data Notification */}
      {errorMsg && (
        <div className="p-4 bg-amber-950/40 border border-amber-800 text-amber-300 text-xs rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-amber-200">Insufficient Telemetry Data for Forecast</div>
            <div>{errorMsg}</div>
            <div className="text-[11px] text-amber-400/80">
              Trigger manual health checks in the Targets tab or wait for the autonomous background collector to populate 10+ data points.
            </div>
          </div>
        </div>
      )}

      {/* Forecast Results Dashboard */}
      {forecast && (
        <div className="space-y-6">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <span className="text-xs text-slate-400 block mb-1">Current Ping Latency</span>
              <div className="text-2xl font-bold font-mono text-white tabular-nums">
                {forecast.current_latency_ms !== null && forecast.current_latency_ms !== undefined
                  ? `${forecast.current_latency_ms} ms`
                  : '—'}
              </div>
              <span className="text-[11px] text-slate-500">Most recent actual probe</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <span className="text-xs text-slate-400 block mb-1">
                Forecast ({forecast.horizon_minutes}m Horizon)
              </span>
              <div className="text-2xl font-bold font-mono text-cyan-400 tabular-nums">
                {forecast.predicted_latency_ms} ms
              </div>
              <span className="text-[11px] text-slate-500">Projected trend value</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <span className="text-xs text-slate-400 block mb-1">Latency Drift Rate</span>
              <div className={`text-2xl font-bold font-mono tabular-nums ${
                (forecast.slope_per_minute || 0) > 0.05 ? 'text-amber-400' : 'text-slate-300'
              }`}>
                {(forecast.slope_per_minute || 0) > 0 ? '+' : ''}{forecast.slope_per_minute}
                <span className="text-xs font-normal text-slate-400 ml-1">ms/min</span>
              </div>
              <span className="text-[11px] text-slate-500">Model slope (m)</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <span className="text-xs text-slate-400 block mb-1">Degradation Risk</span>
              <div className="text-2xl font-bold font-mono">
                {forecast.degradation_risk === 'HIGH' && <span className="text-rose-400">HIGH RISK</span>}
                {forecast.degradation_risk === 'MODERATE' && <span className="text-amber-400">MODERATE</span>}
                {forecast.degradation_risk === 'LOW' && <span className="text-emerald-400">LOW (STABLE)</span>}
              </div>
              <span className="text-[11px] text-slate-500">Threshold evaluation</span>
            </div>
          </div>

          {/* Combined Historical & Horizon Projection Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Historical Observations vs. Forecast Horizon (+{forecast.horizon_minutes}m)
                </h2>
                <p className="text-[11px] text-slate-400">
                  Solid cyan curve shows verified history; dashed orange trajectory projects linear extrapolation.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                <span>R²: <strong className="text-slate-200">{forecast.r_squared}</strong></span>
                <span>N: <strong className="text-slate-200">{forecast.sample_size}</strong></span>
              </div>
            </div>

            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combinedChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="ms" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }}
                    formatter={(val: any, name: any) => [`${val} ms`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                  {forecast.warning_threshold_ms && (
                    <ReferenceLine
                      y={forecast.warning_threshold_ms}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{ value: `Warning (${forecast.warning_threshold_ms}ms)`, fill: '#f59e0b', fontSize: 10 }}
                    />
                  )}
                  {forecast.critical_threshold_ms && (
                    <ReferenceLine
                      y={forecast.critical_threshold_ms}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      label={{ value: `Critical (${forecast.critical_threshold_ms}ms)`, fill: '#ef4444', fontSize: 10 }}
                    />
                  )}

                  <Line
                    type="monotone"
                    dataKey="historyLatency"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    name="Actual Historical Latency"
                    connectNulls={false}
                  />

                  <Line
                    type="monotone"
                    dataKey="forecastLatency"
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3 }}
                    name="Projected Forecast Horizon"
                    connectNulls={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Model Specification and Limitations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2 text-xs">
              <h3 className="font-semibold text-white">Mathematical Model Specification</h3>
              <ul className="space-y-1 text-slate-300 font-mono text-[11px]">
                <li>Algorithm: {forecast.model_method}</li>
                <li>Equation: y = ({forecast.slope_per_minute}/60) * x + {forecast.intercept}</li>
                <li>Sample Size: {forecast.sample_size} verified observations</li>
                <li>Correlation Coefficient (R²): {forecast.r_squared}</li>
                <li>Generated At: {new Date(forecast.generated_at || '').toLocaleString()}</li>
              </ul>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2 text-xs">
              <h3 className="font-semibold text-white">Risk Evaluation &amp; Limitations</h3>
              <p className="text-slate-300">
                <strong>Status:</strong> {forecast.risk_description}
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {forecast.limitations_text}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
