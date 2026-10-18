from flask import Blueprint, jsonify, request
from backend.models import MonitoredTarget, NetworkMetric, Anomaly, Incident
from backend.services.monitoring_service import MonitoringService
from backend.extensions import db
import datetime

dashboard_bp = Blueprint('dashboard_bp', __name__, url_prefix='/api/v1/dashboard')

_last_nic_sample = {'time': 0, 'rx': 0, 'tx': 0, 'rx_rate': 0.0, 'tx_rate': 0.0}

@dashboard_bp.route('/summary', methods=['GET'])
def get_summary():
    global _last_nic_sample
    targets = MonitoredTarget.query.all()
    total_targets = len(targets)
    
    reachable_count = sum(1 for t in targets if t.status == 'UP')
    degraded_count = sum(1 for t in targets if t.status == 'DEGRADED')
    failing_count = sum(1 for t in targets if t.status == 'DOWN')
    
    # Calculate recent average latency and packet loss (past 1 hour)
    one_hour_ago = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    recent_metrics = NetworkMetric.query.filter(NetworkMetric.timestamp >= one_hour_ago).all()
    
    valid_latencies = [m.ping_latency_ms for m in recent_metrics if m.ping_latency_ms is not None]
    avg_latency = round(sum(valid_latencies) / len(valid_latencies), 2) if valid_latencies else None
    
    if recent_metrics:
        avg_packet_loss = round(sum(m.packet_loss_pct for m in recent_metrics) / len(recent_metrics), 2)
    else:
        avg_packet_loss = 0.0
        
    # Active anomalies & open incidents
    active_anomalies = Anomaly.query.filter_by(is_resolved=False).count()
    open_incidents = Incident.query.filter(Incident.status.in_(['OPEN', 'INVESTIGATING', 'ACKNOWLEDGED'])).count()
    
    # Compute interface throughput rate (KB/s)
    nic_stats = MonitoringService.get_interface_stats()
    now_time = datetime.datetime.utcnow().timestamp()
    rx_bytes = nic_stats.get('bytes_recv', 0)
    tx_bytes = nic_stats.get('bytes_sent', 0)
    
    if _last_nic_sample['time'] > 0 and now_time > _last_nic_sample['time']:
        dt = now_time - _last_nic_sample['time']
        rx_diff = max(0, rx_bytes - _last_nic_sample['rx'])
        tx_diff = max(0, tx_bytes - _last_nic_sample['tx'])
        rx_rate = round((rx_diff / dt) / 1024, 2)  # KB/s
        tx_rate = round((tx_diff / dt) / 1024, 2)  # KB/s
        _last_nic_sample = {'time': now_time, 'rx': rx_bytes, 'tx': tx_bytes, 'rx_rate': rx_rate, 'tx_rate': tx_rate}
    else:
        _last_nic_sample = {'time': now_time, 'rx': rx_bytes, 'tx': tx_bytes, 'rx_rate': 0.0, 'tx_rate': 0.0}
        
    return jsonify({
        'total_targets': total_targets,
        'reachable_targets': reachable_count,
        'degraded_targets': degraded_count,
        'failing_targets': failing_count,
        'avg_latency_ms': avg_latency,
        'avg_packet_loss_pct': avg_packet_loss,
        'active_anomalies': active_anomalies,
        'open_incidents': open_incidents,
        'local_throughput': {
            'interface': nic_stats.get('interface', 'total'),
            'rx_rate_kbps': _last_nic_sample['rx_rate'],
            'tx_rate_kbps': _last_nic_sample['tx_rate'],
            'total_rx_mb': round(rx_bytes / (1024 * 1024), 2),
            'total_tx_mb': round(tx_bytes / (1024 * 1024), 2)
        },
        'timestamp': datetime.datetime.utcnow().isoformat()
    }), 200

@dashboard_bp.route('/timeseries', methods=['GET'])
def get_timeseries():
    hours = request.args.get('hours', 6, type=int)
    target_id = request.args.get('target_id', type=int)
    
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=hours)
    query = NetworkMetric.query.filter(NetworkMetric.timestamp >= cutoff)
    if target_id:
        query = query.filter_by(target_id=target_id)
        
    metrics = query.order_by(NetworkMetric.timestamp.asc()).all()
    
    # Map metrics into chart series
    series = []
    for m in metrics:
        series.append({
            'timestamp': m.timestamp.isoformat(),
            'target_id': m.target_id,
            'target_name': m.target.name if m.target else f"#{m.target_id}",
            'ping_latency_ms': m.ping_latency_ms,
            'packet_loss_pct': m.packet_loss_pct,
            'http_response_time_ms': m.http_response_time_ms,
            'is_reachable': 1 if m.is_reachable else 0
        })
        
    # Recent anomalies in this window
    anom_query = Anomaly.query.filter(Anomaly.timestamp >= cutoff)
    if target_id:
        anom_query = anom_query.filter_by(target_id=target_id)
    anomalies = anom_query.order_by(Anomaly.timestamp.asc()).all()
    
    return jsonify({
        'time_range_hours': hours,
        'metrics_count': len(series),
        'series': series,
        'anomalies': [a.to_dict() for a in anomalies]
    }), 200
