from flask import Blueprint, request, jsonify
from backend.models import MonitoredTarget, NetworkMetric
from backend.services.monitoring_service import MonitoringService
from backend.services.anomaly_service import AnomalyService
from backend.routes.auth_routes import login_required, admin_required
from backend.extensions import db
import datetime
import re

target_bp = Blueprint('target_bp', __name__, url_prefix='/api/v1/targets')

def is_valid_host(host: str) -> bool:
    if not host or len(host) > 255:
        return False
    # Check IP or valid domain syntax
    ip_pattern = r'^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'
    domain_pattern = r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
    return bool(re.match(ip_pattern, host) or re.match(domain_pattern, host) or host in ('localhost', '127.0.0.1'))

@target_bp.route('', methods=['GET'])
def list_targets():
    targets = MonitoredTarget.query.order_by(MonitoredTarget.created_at.desc()).all()
    results = []
    for t in targets:
        last_metric = NetworkMetric.query.filter_by(target_id=t.id)\
            .order_by(NetworkMetric.timestamp.desc()).first()
        results.append(t.to_dict(last_metric=last_metric))
    return jsonify(results), 200

@target_bp.route('', methods=['POST'])
@login_required
def create_target(current_user):
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    hostname = data.get('hostname', '').strip()
    http_url = data.get('http_url', '').strip() or None
    target_type = data.get('target_type', 'DUAL').upper()
    interval_sec = int(data.get('interval_sec', 15))
    timeout_sec = int(data.get('timeout_sec', 3))
    warning_ms = float(data.get('warning_threshold_ms', 150.0))
    critical_ms = float(data.get('critical_threshold_ms', 300.0))

    if not name:
        return jsonify({'error': 'Target name is required.'}), 400
    if not is_valid_host(hostname):
        return jsonify({'error': 'Invalid hostname or IP address format.'}), 400
    if target_type not in ('ICMP', 'HTTP', 'DUAL'):
        target_type = 'DUAL'
    if interval_sec < 5 or interval_sec > 3600:
        return jsonify({'error': 'Interval must be between 5 and 3600 seconds.'}), 400
    if timeout_sec < 1 or timeout_sec > 30:
        return jsonify({'error': 'Timeout must be between 1 and 30 seconds.'}), 400
    if critical_ms <= warning_ms:
        return jsonify({'error': 'Critical threshold must be strictly greater than warning threshold.'}), 400

    target = MonitoredTarget(
        name=name,
        hostname=hostname,
        http_url=http_url,
        target_type=target_type,
        interval_sec=interval_sec,
        timeout_sec=timeout_sec,
        warning_threshold_ms=warning_ms,
        critical_threshold_ms=critical_ms,
        is_enabled=True,
        status='UNKNOWN'
    )
    db.session.add(target)
    db.session.commit()

    return jsonify({
        'message': 'Monitoring target created successfully',
        'target': target.to_dict()
    }), 201

@target_bp.route('/<int:target_id>', methods=['GET'])
def get_target(target_id):
    target = MonitoredTarget.query.get_or_404(target_id)
    last_metric = NetworkMetric.query.filter_by(target_id=target.id)\
        .order_by(NetworkMetric.timestamp.desc()).first()
    return jsonify(target.to_dict(last_metric=last_metric)), 200

@target_bp.route('/<int:target_id>', methods=['PATCH'])
@login_required
def update_target(current_user, target_id):
    target = MonitoredTarget.query.get_or_404(target_id)
    data = request.get_json() or {}

    if 'name' in data:
        target.name = data['name'].strip()
    if 'hostname' in data:
        if not is_valid_host(data['hostname'].strip()):
            return jsonify({'error': 'Invalid hostname format.'}), 400
        target.hostname = data['hostname'].strip()
    if 'http_url' in data:
        target.http_url = data['http_url'].strip() or None
    if 'target_type' in data:
        if data['target_type'].upper() in ('ICMP', 'HTTP', 'DUAL'):
            target.target_type = data['target_type'].upper()
    if 'interval_sec' in data:
        target.interval_sec = max(5, min(3600, int(data['interval_sec'])))
    if 'timeout_sec' in data:
        target.timeout_sec = max(1, min(30, int(data['timeout_sec'])))
    if 'warning_threshold_ms' in data:
        target.warning_threshold_ms = float(data['warning_threshold_ms'])
    if 'critical_threshold_ms' in data:
        target.critical_threshold_ms = float(data['critical_threshold_ms'])
    if 'is_enabled' in data:
        target.is_enabled = bool(data['is_enabled'])

    target.updated_at = datetime.datetime.utcnow()
    db.session.commit()

    last_metric = NetworkMetric.query.filter_by(target_id=target.id)\
        .order_by(NetworkMetric.timestamp.desc()).first()
    return jsonify({
        'message': 'Target updated successfully',
        'target': target.to_dict(last_metric=last_metric)
    }), 200

@target_bp.route('/<int:target_id>', methods=['DELETE'])
@admin_required
def delete_target(current_user, target_id):
    target = MonitoredTarget.query.get_or_404(target_id)
    db.session.delete(target)
    db.session.commit()
    return jsonify({'message': f'Target {target.name} deleted successfully'}), 200

@target_bp.route('/<int:target_id>/check', methods=['POST'])
@login_required
def check_target_now(current_user, target_id):
    """
    Executes an on-demand real probe (ICMP ping and/or HTTP check) for the target.
    Persists metric and evaluates anomalies immediately.
    """
    target = MonitoredTarget.query.get_or_404(target_id)
    target.status = 'CHECKING'
    db.session.commit()

    ping_res = None
    http_res = None
    errors = []

    # 1. ICMP Ping probe
    if target.target_type in ('ICMP', 'DUAL'):
        ping_res = MonitoringService.ping_host(
            target.hostname, count=3, timeout_sec=target.timeout_sec
        )
        if ping_res.get('error'):
            errors.append(f"Ping: {ping_res['error']}")

    # 2. HTTP probe
    if target.target_type in ('HTTP', 'DUAL') and target.http_url:
        http_res = MonitoringService.check_http(
            target.http_url, timeout_sec=target.timeout_sec
        )
        if http_res.get('error'):
            errors.append(f"HTTP: {http_res['error']}")

    # Determine overall status
    is_reachable = True
    latency = None
    packet_loss = 0.0

    if ping_res:
        latency = ping_res['latency_ms']
        packet_loss = ping_res['packet_loss_pct']
        if not ping_res['reachable']:
            is_reachable = False
    elif http_res:
        latency = http_res['response_time_ms']
        if not http_res['reachable']:
            is_reachable = False

    if not is_reachable:
        new_status = 'DOWN'
    elif (latency and latency >= target.warning_threshold_ms) or packet_loss > 0:
        new_status = 'DEGRADED'
    else:
        new_status = 'UP'

    target.status = new_status
    target.updated_at = datetime.datetime.utcnow()

    # Create and record NetworkMetric
    metric = NetworkMetric(
        target_id=target.id,
        timestamp=datetime.datetime.utcnow(),
        ping_latency_ms=ping_res['latency_ms'] if ping_res else None,
        packet_loss_pct=ping_res['packet_loss_pct'] if ping_res else 0.0,
        http_status_code=http_res['status_code'] if http_res else None,
        http_response_time_ms=http_res['response_time_ms'] if http_res else None,
        is_reachable=is_reachable,
        method_used=target.target_type,
        error_message="; ".join(errors) if errors else None
    )
    db.session.add(metric)
    db.session.commit()

    # Run anomaly detection
    anomalies = AnomalyService.evaluate_metric(target, metric)

    return jsonify({
        'message': f"Check completed for {target.name}",
        'target': target.to_dict(last_metric=metric),
        'metric': metric.to_dict(),
        'anomalies_detected': [a.to_dict() for a in anomalies]
    }), 200

@target_bp.route('/<int:target_id>/monitoring', methods=['POST'])
@login_required
def toggle_monitoring(current_user, target_id):
    target = MonitoredTarget.query.get_or_404(target_id)
    data = request.get_json() or {}
    enabled = data.get('enabled', not target.is_enabled)
    target.is_enabled = bool(enabled)
    db.session.commit()
    return jsonify({
        'message': f"Monitoring {'enabled' if target.is_enabled else 'disabled'} for {target.name}",
        'is_enabled': target.is_enabled
    }), 200
