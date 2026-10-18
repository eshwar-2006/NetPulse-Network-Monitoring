from flask import Blueprint, request, jsonify, Response
from backend.models import NetworkMetric, MonitoredTarget
from backend.services.monitoring_service import MonitoringService
from backend.routes.auth_routes import login_required
import io
import csv
import datetime

metric_bp = Blueprint('metric_bp', __name__, url_prefix='/api/v1/metrics')

@metric_bp.route('', methods=['GET'])
def get_metrics():
    target_id = request.args.get('target_id', type=int)
    limit = min(request.args.get('limit', 200, type=int), 1000)
    
    query = NetworkMetric.query
    if target_id:
        query = query.filter_by(target_id=target_id)
        
    metrics = query.order_by(NetworkMetric.timestamp.desc()).limit(limit).all()
    # Reverse to chronological for charts
    metrics.reverse()
    return jsonify([m.to_dict() for m in metrics]), 200

@metric_bp.route('/interfaces', methods=['GET'])
def get_interfaces():
    interface_name = request.args.get('name')
    stats = MonitoringService.get_interface_stats(interface_name)
    return jsonify(stats), 200

@metric_bp.route('/export', methods=['GET'])
def export_metrics():
    target_id = request.args.get('target_id', type=int)
    hours = request.args.get('hours', 24, type=int)
    
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=hours)
    query = NetworkMetric.query.filter(NetworkMetric.timestamp >= cutoff)
    if target_id:
        query = query.filter(NetworkMetric.target_id == target_id)
        
    records = query.order_by(NetworkMetric.timestamp.asc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Measurement_ID', 'Target_ID', 'Target_Name', 'Timestamp_UTC',
        'Ping_Latency_ms', 'Packet_Loss_pct', 'HTTP_Status_Code',
        'HTTP_Response_Time_ms', 'Is_Reachable', 'Method_Used', 'Error_Details'
    ])
    
    targets_cache = {t.id: t.name for t in MonitoredTarget.query.all()}
    
    for r in records:
        writer.writerow([
            r.id,
            r.target_id,
            targets_cache.get(r.target_id, f"Target #{r.target_id}"),
            r.timestamp.isoformat() if r.timestamp else '',
            f"{r.ping_latency_ms:.2f}" if r.ping_latency_ms is not None else '',
            f"{r.packet_loss_pct:.1f}",
            r.http_status_code or '',
            f"{r.http_response_time_ms:.2f}" if r.http_response_time_ms is not None else '',
            '1' if r.is_reachable else '0',
            r.method_used,
            r.error_message or ''
        ])
        
    csv_data = output.getvalue()
    filename = f"netpulse_metrics_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return Response(
        csv_data,
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment;filename={filename}'}
    )
