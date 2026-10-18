export interface User {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'TECHNICIAN';
  full_name: string | null;
  created_at: string;
}

export interface MonitoredTarget {
  id: number;
  name: string;
  hostname: string;
  http_url: string | null;
  target_type: 'ICMP' | 'HTTP' | 'DUAL';
  interval_sec: number;
  timeout_sec: number;
  warning_threshold_ms: number;
  critical_threshold_ms: number;
  is_enabled: boolean;
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN' | 'CHECKING';
  created_at: string;
  updated_at: string;
  last_latency_ms: number | null;
  last_packet_loss: number | null;
  last_http_time_ms: number | null;
  last_check_time: string | null;
}

export interface NetworkMetric {
  id: number;
  target_id: number;
  target_name?: string;
  timestamp: string;
  ping_latency_ms: number | null;
  packet_loss_pct: number;
  http_status_code: number | null;
  http_response_time_ms: number | null;
  is_reachable: boolean | number;
  method_used: string;
  error_message: string | null;
}

export interface Anomaly {
  id: number;
  target_id: number;
  target_name?: string;
  metric_id: number | null;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  detection_method: 'STATIC_THRESHOLD' | 'ROLLING_MAD' | 'CONSECUTIVE_FAILURES' | 'PACKET_LOSS_SPIKE' | 'HTTP_LATENCY_SPIKE';
  observed_value: number | null;
  baseline_value: number | null;
  threshold_value: number | null;
  explanation: string;
  is_acknowledged: boolean;
  is_resolved: boolean;
  notes: string | null;
}

export interface ForecastResult {
  success: boolean;
  error?: string;
  forecast_id?: number;
  target_id?: number;
  target_name?: string;
  horizon_minutes?: number;
  model_method?: string;
  slope_per_minute?: number;
  intercept?: number;
  r_squared?: number;
  sample_size?: number;
  current_latency_ms?: number | null;
  predicted_latency_ms?: number;
  degradation_risk?: 'LOW' | 'MODERATE' | 'HIGH';
  risk_description?: string;
  warning_threshold_ms?: number;
  critical_threshold_ms?: number;
  limitations_text?: string;
  generated_at?: string;
  historical_points?: Array<{ timestamp: string; latency_ms: number | null; is_forecast: boolean }>;
  forecast_points?: Array<{ timestamp: string; predicted_latency_ms: number; is_forecast: boolean }>;
}

export interface Incident {
  id: number;
  incident_id: string;
  title: string;
  description: string;
  target_id: number | null;
  target_name?: string | null;
  anomaly_id: number | null;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolution_notes: string | null;
  resolved_at: string | null;
}

export interface Milestone {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  completion_pct: number;
  created_at: string;
}

export interface TaskItem {
  id: number;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignee: string | null;
  start_date: string | null;
  due_date: string | null;
  milestone_id: number | null;
  milestone_title?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardSummary {
  total_targets: number;
  reachable_targets: number;
  degraded_targets: number;
  failing_targets: number;
  avg_latency_ms: number | null;
  avg_packet_loss_pct: number;
  active_anomalies: number;
  open_incidents: number;
  local_throughput: {
    interface: string;
    rx_rate_kbps: number;
    tx_rate_kbps: number;
    total_rx_mb: number;
    total_tx_mb: number;
  };
  timestamp: string;
}
