import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Incident, MonitoredTarget } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import {
  Flame,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  User,
  AlertTriangle,
  FileText,
  Download,
  Edit2
} from 'lucide-react';

export const IncidentsPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [targets, setTargets] = useState<MonitoredTarget[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    target_id: '' as string | number,
    severity: 'HIGH' as 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL',
    assigned_to: ''
  });

  // Edit / Status Form State
  const [editStatus, setEditStatus] = useState<string>('OPEN');
  const [editSeverity, setEditSeverity] = useState<string>('HIGH');
  const [editAssignee, setEditAssignee] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  const fetchIncidents = async () => {
    try {
      const [incList, targetList] = await Promise.all([
        api.getIncidents({
          search: search.trim() || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          severity: severityFilter === 'all' ? undefined : severityFilter
        }),
        api.getTargets()
      ]);
      setIncidents(incList);
      setTargets(targetList);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [search, statusFilter, severityFilter]);

  // Handle incoming anomaly escalation from navigate state
  useEffect(() => {
    if (location.state && (location.state as any).newIncident) {
      const inc = (location.state as any).newIncident;
      setCreateForm({
        title: inc.title || '',
        description: inc.description || '',
        target_id: inc.target_id || '',
        severity: inc.severity || 'HIGH',
        assigned_to: user?.username || ''
      });
      setIsCreateModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, user]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.description.trim()) return;

    try {
      await api.createIncident({
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        target_id: createForm.target_id ? Number(createForm.target_id) : null,
        severity: createForm.severity,
        assigned_to: createForm.assigned_to.trim() || user?.username || 'Unassigned'
      });
      setIsCreateModalOpen(false);
      setCreateForm({ title: '', description: '', target_id: '', severity: 'HIGH', assigned_to: '' });
      await fetchIncidents();
    } catch (err: any) {
      alert(`Create incident failed: ${err.message}`);
    }
  };

  const openEditModal = (inc: Incident) => {
    setEditingIncident(inc);
    setEditStatus(inc.status);
    setEditSeverity(inc.severity);
    setEditAssignee(inc.assigned_to || '');
    setResolutionNotes('');
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIncident) return;

    try {
      await api.updateIncident(editingIncident.id, {
        status: editStatus,
        severity: editSeverity,
        assigned_to: editAssignee,
        resolution_notes: resolutionNotes.trim() || undefined
      });
      setEditingIncident(null);
      await fetchIncidents();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const openCount = incidents.filter(i => ['OPEN', 'INVESTIGATING', 'ACKNOWLEDGED'].includes(i.status)).length;
  const criticalCount = incidents.filter(i => i.severity === 'CRITICAL' && i.status !== 'CLOSED').length;
  const resolvedCount = incidents.filter(i => ['RESOLVED', 'CLOSED'].includes(i.status)).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-400" />
            NOC Incident Management &amp; Dispatch
          </h1>
          <p className="text-xs text-slate-400">
            Escalation desk, technician assignment, status tracking, and resolution audit trail.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={api.getIncidentsExportUrl()}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={() => {
              setCreateForm({
                title: '',
                description: '',
                target_id: '',
                severity: 'HIGH',
                assigned_to: user?.username || ''
              });
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Incident</span>
          </button>
        </div>
      </div>

      {/* KPI Count Strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
          <span className="text-xs text-slate-400">Open &amp; Investigating</span>
          <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">{openCount}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
          <span className="text-xs text-slate-400">Critical Priority</span>
          <div className="text-2xl font-bold font-mono text-rose-400 tabular-nums">{criticalCount}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
          <span className="text-xs text-slate-400">Resolved / Closed</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">{resolvedCount}</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search tickets by ID, title, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-md text-slate-200"
        >
          <option value="all">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="INVESTIGATING">Investigating</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-md text-slate-200"
        >
          <option value="all">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
      </div>

      {/* Incidents Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="px-4 py-3">Ticket ID</th>
                <th className="px-4 py-3">Title &amp; Target</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {incidents.map((inc) => {
                let sevStyle = 'text-slate-300 bg-slate-800 border-slate-700';
                if (inc.severity === 'CRITICAL') sevStyle = 'text-rose-400 bg-rose-950/50 border-rose-800/60';
                if (inc.severity === 'HIGH') sevStyle = 'text-orange-400 bg-orange-950/50 border-orange-800/60';
                if (inc.severity === 'WARNING') sevStyle = 'text-amber-400 bg-amber-950/50 border-amber-800/60';
                if (inc.severity === 'INFO') sevStyle = 'text-blue-400 bg-blue-950/50 border-blue-800/60';

                let stStyle = 'text-slate-400 border-slate-700 bg-slate-800';
                if (inc.status === 'OPEN') stStyle = 'text-rose-400 border-rose-800/50 bg-rose-950/40';
                if (inc.status === 'INVESTIGATING') stStyle = 'text-cyan-400 border-cyan-800/50 bg-cyan-950/40';
                if (inc.status === 'RESOLVED') stStyle = 'text-emerald-400 border-emerald-800/50 bg-emerald-950/40';

                return (
                  <tr key={inc.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-cyan-400">
                      {inc.incident_id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{inc.title}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>Target: <strong className="text-slate-300">{inc.target_name || 'N/A'}</strong></span>
                        {inc.anomaly_id && (
                          <span className="text-amber-400/80">· Triggered by Anomaly #{inc.anomaly_id}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border font-mono ${sevStyle}`}>
                        {inc.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${stStyle}`}>
                        {inc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-300">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        {inc.assigned_to || 'Unassigned'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {new Date(inc.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(inc)}
                        className="px-2.5 py-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40 border border-cyan-800/40 rounded transition-colors"
                      >
                        Manage Ticket
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {incidents.length === 0 && !isLoading && (
          <div className="text-center py-10 text-xs text-slate-500">
            No incidents found matching current filters.
          </div>
        )}
      </div>

      {/* Create Incident Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">Create Incident Ticket</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Incident Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Core Switch BGP Latency Elevation"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Related Target</label>
                  <select
                    value={createForm.target_id}
                    onChange={(e) => setCreateForm({ ...createForm, target_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">General Network Issue</option>
                    {targets.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Severity</label>
                  <select
                    value={createForm.severity}
                    onChange={(e) => setCreateForm({ ...createForm, severity: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="CRITICAL">Critical (Immediate Outage)</option>
                    <option value="HIGH">High (Performance Degradation)</option>
                    <option value="WARNING">Warning (Elevated Jitter)</option>
                    <option value="INFO">Info (Diagnostic Notice)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Assigned Technician</label>
                <input
                  type="text"
                  placeholder="e.g. technician or admin"
                  value={createForm.assigned_to}
                  onChange={(e) => setCreateForm({ ...createForm, assigned_to: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Incident Description *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Detail observed symptoms, affected hops, packet drop percentages..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-md"
                >
                  Create Incident Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Manage Incident Modal */}
      {editingIncident && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div>
                <span className="font-mono text-cyan-400 text-xs font-bold">{editingIncident.incident_id}</span>
                <h2 className="text-base font-bold text-white">{editingIncident.title}</h2>
              </div>
              <button onClick={() => setEditingIncident(null)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-950/80 rounded border border-slate-800 text-xs text-slate-300 whitespace-pre-wrap">
              <strong className="text-slate-400 block mb-1">Description:</strong>
              {editingIncident.description}
            </div>

            {editingIncident.resolution_notes && (
              <div className="p-3 bg-slate-950/80 rounded border border-slate-800 text-xs text-slate-300 whitespace-pre-wrap">
                <strong className="text-emerald-400 block mb-1">Audit Trail &amp; Updates:</strong>
                {editingIncident.resolution_notes}
              </div>
            )}

            <form onSubmit={handleUpdateSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                    <option value="INVESTIGATING">INVESTIGATING</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Severity</label>
                  <select
                    value={editSeverity}
                    onChange={(e) => setEditSeverity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="WARNING">WARNING</option>
                    <option value="INFO">INFO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Assigned Technician</label>
                <input
                  type="text"
                  value={editAssignee}
                  onChange={(e) => setEditAssignee(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Add Resolution Note / Action Taken
                </label>
                <textarea
                  rows={2}
                  placeholder="Record investigation findings, route reconfigurations, hardware swaps..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingIncident(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-500 rounded-md"
                >
                  Save Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
