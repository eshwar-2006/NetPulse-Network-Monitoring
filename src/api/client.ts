import {
  User,
  MonitoredTarget,
  NetworkMetric,
  Anomaly,
  ForecastResult,
  Incident,
  Milestone,
  TaskItem,
  DashboardSummary
} from '../types';

const BASE_URL = '/api/v1';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('netpulse_token');
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch {}
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  // Auth
  async register(data: { username: string; email: string; password: string; role?: string; full_name?: string }) {
    return request<{ message: string; user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async login(data: { username: string; password: string }) {
    return request<{ message: string; user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async logout() {
    return request<{ message: string }>('/auth/logout', { method: 'POST' });
  },

  async getMe() {
    return request<{ authenticated: boolean; user: User | null }>('/auth/me');
  },

  // Dashboard
  async getDashboardSummary() {
    return request<DashboardSummary>('/dashboard/summary');
  },

  async getDashboardTimeseries(hours: number = 6, targetId?: number) {
    const params = new URLSearchParams({ hours: String(hours) });
    if (targetId) params.append('target_id', String(targetId));
    return request<{
      time_range_hours: number;
      metrics_count: number;
      series: any[];
      anomalies: any[];
    }>(`/dashboard/timeseries?${params.toString()}`);
  },

  // Targets
  async getTargets() {
    return request<MonitoredTarget[]>('/targets');
  },

  async getTarget(id: number) {
    return request<MonitoredTarget>(`/targets/${id}`);
  },

  async createTarget(data: Partial<MonitoredTarget>) {
    return request<{ message: string; target: MonitoredTarget }>('/targets', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateTarget(id: number, data: Partial<MonitoredTarget>) {
    return request<{ message: string; target: MonitoredTarget }>(`/targets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async deleteTarget(id: number) {
    return request<{ message: string }>(`/targets/${id}`, { method: 'DELETE' });
  },

  async checkTargetNow(id: number) {
    return request<{
      message: string;
      target: MonitoredTarget;
      metric: NetworkMetric;
      anomalies_detected: Anomaly[];
    }>(`/targets/${id}/check`, { method: 'POST' });
  },

  async toggleMonitoring(id: number, enabled?: boolean) {
    return request<{ message: string; is_enabled: boolean }>(`/targets/${id}/monitoring`, {
      method: 'POST',
      body: JSON.stringify({ enabled })
    });
  },

  // Metrics
  async getMetrics(targetId?: number, limit: number = 200) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (targetId) params.append('target_id', String(targetId));
    return request<NetworkMetric[]>(`/metrics?${params.toString()}`);
  },

  async getInterfaceStats(name?: string) {
    const params = new URLSearchParams();
    if (name) params.append('name', name);
    return request<any>(`/metrics/interfaces?${params.toString()}`);
  },

  getMetricsExportUrl(hours: number = 24, targetId?: number) {
    const params = new URLSearchParams({ hours: String(hours) });
    if (targetId) params.append('target_id', String(targetId));
    return `/api/v1/metrics/export?${params.toString()}`;
  },

  // Anomalies
  async getAnomalies(params?: { target_id?: number; severity?: string; resolved?: boolean }) {
    const q = new URLSearchParams();
    if (params?.target_id) q.append('target_id', String(params.target_id));
    if (params?.severity) q.append('severity', params.severity);
    if (params?.resolved !== undefined) q.append('resolved', String(params.resolved));
    return request<Anomaly[]>(`/anomalies?${q.toString()}`);
  },

  async acknowledgeAnomaly(id: number) {
    return request<{ message: string; anomaly: Anomaly }>(`/anomalies/${id}/acknowledge`, { method: 'POST' });
  },

  async resolveAnomaly(id: number, notes?: string) {
    return request<{ message: string; anomaly: Anomaly }>(`/anomalies/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    });
  },

  // Forecasting
  async getForecasts(targetId?: number) {
    const params = new URLSearchParams();
    if (targetId) params.append('target_id', String(targetId));
    return request<any[]>(`/forecasts?${params.toString()}`);
  },

  async generateForecast(targetId: number, horizonMinutes: number = 30) {
    return request<ForecastResult>('/forecasts/generate', {
      method: 'POST',
      body: JSON.stringify({ target_id: targetId, horizon_minutes: horizonMinutes })
    });
  },

  // Incidents
  async getIncidents(params?: { status?: string; severity?: string; target_id?: number; search?: string }) {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.severity) q.append('severity', params.severity);
    if (params?.target_id) q.append('target_id', String(params.target_id));
    if (params?.search) q.append('search', params.search);
    return request<Incident[]>(`/incidents?${q.toString()}`);
  },

  async createIncident(data: {
    title: string;
    description: string;
    target_id?: number | null;
    anomaly_id?: number | null;
    severity?: string;
    assigned_to?: string;
  }) {
    return request<{ message: string; incident: Incident }>('/incidents', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateIncident(id: number, data: {
    status?: string;
    severity?: string;
    assigned_to?: string;
    resolution_notes?: string;
  }) {
    return request<{ message: string; incident: Incident }>(`/incidents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  getIncidentsExportUrl() {
    return '/api/v1/incidents/export';
  },

  // Tasks & Milestones
  async getMilestones() {
    return request<Milestone[]>('/milestones');
  },

  async createMilestone(data: { title: string; description?: string; due_date?: string }) {
    return request<Milestone>('/milestones', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getTasks(params?: { status?: string; priority?: string; milestone_id?: number }) {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.priority) q.append('priority', params.priority);
    if (params?.milestone_id) q.append('milestone_id', String(params.milestone_id));
    return request<TaskItem[]>(`/tasks?${q.toString()}`);
  },

  async createTask(data: Partial<TaskItem>) {
    return request<TaskItem>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateTask(id: number, data: Partial<TaskItem>) {
    return request<TaskItem>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async deleteTask(id: number) {
    return request<{ message: string }>(`/tasks/${id}`, { method: 'DELETE' });
  },

  // Settings
  async getSettings() {
    return request<{ [key: string]: { value: string; description: string } }>('/settings');
  },

  async updateSettings(data: { [key: string]: string }) {
    return request<{ message: string; settings: any }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }
};
