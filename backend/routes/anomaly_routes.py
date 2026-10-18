from flask import Blueprint, request, jsonify
from backend.models import Anomaly
from backend.routes.auth_routes import login_required
from backend.extensions import db

anomaly_bp = Blueprint('anomaly_bp', __name__, url_prefix='/api/v1/anomalies')

@anomaly_bp.route('', methods=['GET'])
def list_anomalies():
    target_id = request.args.get('target_id', type=int)
    severity = request.args.get('severity')
    resolved = request.args.get('resolved')
    
    query = Anomaly.query
    if target_id:
        query = query.filter_by(target_id=target_id)
    if severity:
        query = query.filter_by(severity=severity.upper())
    if resolved is not None:
        is_res = resolved.lower() in ('true', '1')
        query = query.filter_by(is_resolved=is_res)
        
    anomalies = query.order_by(Anomaly.timestamp.desc()).limit(100).all()
    return jsonify([a.to_dict() for a in anomalies]), 200

@anomaly_bp.route('/<int:anomaly_id>/acknowledge', methods=['POST'])
@login_required
def acknowledge_anomaly(current_user, anomaly_id):
    anomaly = Anomaly.query.get_or_404(anomaly_id)
    anomaly.is_acknowledged = True
    db.session.commit()
    return jsonify({'message': f'Anomaly #{anomaly_id} acknowledged by {current_user.username}', 'anomaly': anomaly.to_dict()}), 200

@anomaly_bp.route('/<int:anomaly_id>/resolve', methods=['POST'])
@login_required
def resolve_anomaly(current_user, anomaly_id):
    anomaly = Anomaly.query.get_or_404(anomaly_id)
    data = request.get_json() or {}
    notes = data.get('notes', '').strip()
    
    anomaly.is_resolved = True
    anomaly.is_acknowledged = True
    if notes:
        existing = anomaly.notes or ''
        anomaly.notes = f"{existing}\n[Resolved by {current_user.username}]: {notes}".strip()
        
    db.session.commit()
    return jsonify({'message': f'Anomaly #{anomaly_id} marked as resolved', 'anomaly': anomaly.to_dict()}), 200
