import React, { useState } from 'react';
import { api } from '../api/client';
import { Zap, Terminal, Globe, Activity, ArrowRight, ShieldCheck, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const LiveProbePage: React.FC = () => {
  const navigate = useNavigate();
  const [host, setHost] = useState<string>('1.1.1.1');
  const [url, setUrl] = useState<string>('https://1.1.1.1');
  const [probeType, setProbeType] = useState<'ICMP' | 'HTTP'>('ICMP');
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [result, setResult] = useState<any | null>(null);
  const [probeHistory, setProbeHistory] = useState<any[]>([]);

  const executeProbe = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProbing(true);
    setResult(null);

    try {
      if (probeType === 'ICMP') {
        // Find existing target or run check via target API
        let targets = await api.getTargets();
        let target = targets.find(t => t.hostname === host.trim());
        if (!target) {
          // Temporarily create or run target check
          const res = await api.createTarget({
            name: `Diagnostic: ${host.trim()}`,
            hostname: host.trim(),
            target_type: 'ICMP',
            interval_sec: 60,
            timeout_sec: 3
          });
          target = res.target;
        }

        const checkRes = await api.checkTargetNow(target.id);
        const data = {
          type: 'ICMP Ping Probe',
          target: host.trim(),
          latency: checkRes.metric.ping_latency_ms,
          packetLoss: checkRes.metric.packet_loss_pct,
          reachable: checkRes.metric.is_reachable,
          error: checkRes.metric.error_message,
          timestamp: new Date().toLocaleTimeString()
        };
        setResult(data);
        setProbeHistory(prev => [data, ...prev.slice(0, 9)]);
      } else {
        // HTTP Probe
        let targets = await api.getTargets();
        let target = targets.find(t => t.http_url === url.trim() || t.hostname === host.trim());
        if (!target) {
          const res = await api.createTarget({
            name: `Diagnostic HTTP: ${url.trim()}`,
            hostname: new URL(url.startsWith('http') ? url : `https://${url}`).hostname,
            http_url: url.trim(),
            target_type: 'HTTP',
            interval_sec: 60,
            timeout_sec: 5
          });
          target = res.target;
        }

        const checkRes = await api.checkTargetNow(target.id);
        const data = {
          type: 'HTTP/HTTPS Probe',
          target: url.trim(),
          statusCode: checkRes.metric.http_status_code,
          responseTime: checkRes.metric.http_response_time_ms,
          reachable: checkRes.metric.is_reachable,
          error: checkRes.metric.error_message,
          timestamp: new Date().toLocaleTimeString()
        };
        setResult(data);
        setProbeHistory(prev => [data, ...prev.slice(0, 9)]);
      }
    } catch (err: any) {
      setResult({
        type: probeType,
        target: probeType === 'ICMP' ? host : url,
        error: err.message,
        reachable: false,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setIsProbing(false);
    }
  };

  const presetHosts = [
    { name: 'Cloudflare DNS', host: '1.1.1.1', url: 'https://1.1.1.1' },
    { name: 'Google DNS', host: '8.8.8.8', url: 'https://dns.google' },
    { name: 'Quad9 DNS', host: '9.9.9.9', url: 'https://quad9.net' },
    { name: 'GitHub API', host: 'api.github.com', url: 'https://api.github.com' }
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-cyan-400" />
          Interactive Network Diagnostic Probe
        </h1>
        <p className="text-xs text-slate-400">
          Execute instantaneous ICMP packet probes or HTTP/HTTPS latency handshakes against any IPv4/IPv6 host or URL.
        </p>
      </div>

      {/* Preset Targets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 mr-1">Quick Presets:</span>
        {presetHosts.map((p) => (
          <button
            key={p.host}
            onClick={() => {
              setHost(p.host);
              setUrl(p.url);
            }}
            className="px-2.5 py-1 text-xs bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 rounded text-slate-300 font-mono transition-colors"
          >
            {p.name} ({p.host})
          </button>
        ))}
      </div>

      {/* Probe Execution Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4">
        <form onSubmit={executeProbe} className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-xs font-semibold text-slate-300">Probe Protocol:</label>
            <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-md border border-slate-800">
              <button
                type="button"
                onClick={() => setProbeType('ICMP')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  probeType === 'ICMP' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                ICMP Ping (Subprocess)
              </button>
              <button
                type="button"
                onClick={() => setProbeType('HTTP')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  probeType === 'HTTP' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                HTTP / HTTPS Probe
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {probeType === 'ICMP' ? 'Host IP or Domain Name' : 'Target HTTP/HTTPS URL'}
              </label>
              <input
                type="text"
                required
                value={probeType === 'ICMP' ? host : url}
                onChange={(e) => probeType === 'ICMP' ? setHost(e.target.value) : setUrl(e.target.value)}
                placeholder={probeType === 'ICMP' ? 'e.g. 1.1.1.1 or cloudflare.com' : 'e.g. https://1.1.1.1'}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={isProbing}
                className="w-full py-2 px-4 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 ${isProbing ? 'animate-bounce' : ''}`} />
                <span>{isProbing ? 'Sending Probes...' : 'Transmit Probe'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Live Terminal Output Box */}
        {result && (
          <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Terminal className="w-3.5 h-3.5" />
                Live Execution Result: {result.type}
              </span>
              <span className="text-[11px] text-slate-500">{result.timestamp}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 text-slate-300">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Target Host</span>
                <span className="font-semibold text-white">{result.target}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Link State</span>
                <span className={`font-semibold ${result.reachable ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {result.reachable ? 'REACHABLE (UP)' : 'UNREACHABLE'}
                </span>
              </div>
              {result.latency !== undefined && (
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">RTT Latency</span>
                  <span className="font-semibold text-cyan-400 tabular-nums">
                    {result.latency !== null ? `${result.latency} ms` : '—'}
                  </span>
                </div>
              )}
              {result.packetLoss !== undefined && (
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Packet Loss</span>
                  <span className={`font-semibold tabular-nums ${result.packetLoss > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {result.packetLoss}%
                  </span>
                </div>
              )}
              {result.statusCode !== undefined && (
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">HTTP Status</span>
                  <span className="font-semibold text-white tabular-nums">
                    {result.statusCode || 'None'}
                  </span>
                </div>
              )}
              {result.responseTime !== undefined && (
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">HTTP Response Time</span>
                  <span className="font-semibold text-blue-400 tabular-nums">
                    {result.responseTime ? `${result.responseTime} ms` : '—'}
                  </span>
                </div>
              )}
            </div>

            {result.error && (
              <div className="p-2 bg-rose-950/40 border border-rose-900/60 text-rose-300 text-[11px] rounded">
                Diagnostic Output: {result.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* History of Probes */}
      {probeHistory.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Recent Session Probes
          </h2>
          <div className="space-y-1.5">
            {probeHistory.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 bg-slate-950/40 border border-slate-800/80 rounded font-mono text-xs text-slate-300"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${h.reachable ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                  <span className="font-semibold text-white">{h.target}</span>
                  <span className="text-slate-500 text-[11px]">{h.type}</span>
                </div>
                <div className="flex items-center gap-4 tabular-nums">
                  {h.latency !== undefined && <span>{h.latency !== null ? `${h.latency} ms` : 'Loss 100%'}</span>}
                  {h.responseTime !== undefined && <span>{h.responseTime} ms</span>}
                  <span className="text-[11px] text-slate-500">{h.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
