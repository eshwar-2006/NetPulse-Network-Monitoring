from flask import Blueprint, request, jsonify
from backend.models import AppSetting
from backend.routes.auth_routes import admin_required
from backend.extensions import db

setting_bp = Blueprint('setting_bp', __name__, url_prefix='/api/v1/settings')

DEFAULT_SETTINGS = {
    'default_interval_sec': ('15', 'Default polling interval for newly created targets in seconds'),
    'default_timeout_sec': ('3', 'Default probe timeout in seconds'),
    'latency_warning_ms': ('150.0', 'Threshold for warning alert on ping latency'),
    'latency_critical_ms': ('300.0', 'Threshold for critical alert on ping latency'),
    'packet_loss_critical_pct': ('5.0', 'Packet loss percentage considered abnormal'),
    'mad_outlier_threshold': ('3.5', 'Modified Z-score threshold for MAD anomaly detection'),
    'forecast_horizon_minutes': ('30', 'Default predictive maintenance horizon in minutes'),
    'app_name': ('NetPulse NOC', 'Application Display Name'),
    'maintenance_window': ('02:00-04:00 UTC', 'Designated system maintenance window')
}

@setting_bp.route('', methods=['GET'])
def get_settings():
    settings = AppSetting.query.all()
    # Initialize defaults if table is empty
    if not settings:
        for k, (val, desc) in DEFAULT_SETTINGS.items():
            s = AppSetting(key=k, value=val, description=desc)
            db.session.add(s)
        db.session.commit()
        settings = AppSetting.query.all()

    result = {s.key: {'value': s.value, 'description': s.description} for s in settings}
    return jsonify(result), 200

@setting_bp.route('', methods=['PATCH'])
@admin_required
def update_settings(current_user):
    data = request.get_json() or {}
    for key, value in data.items():
        setting = AppSetting.query.filter_by(key=key).first()
        if setting:
            setting.value = str(value)
        else:
            setting = AppSetting(key=key, value=str(value))
            db.session.add(setting)
    db.session.commit()

    all_settings = AppSetting.query.all()
    result = {s.key: {'value': s.value, 'description': s.description} for s in all_settings}
    return jsonify({'message': 'Settings updated successfully', 'settings': result}), 200
