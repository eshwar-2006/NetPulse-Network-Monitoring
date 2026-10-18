import os
import threading
import time
from flask import Flask, jsonify
from flask_cors import CORS
from backend.config import Config
from backend.extensions import db
from backend.routes.auth_routes import auth_bp
from backend.routes.dashboard_routes import dashboard_bp
from backend.routes.target_routes import target_bp
from backend.routes.metric_routes import metric_bp
from backend.routes.anomaly_routes import anomaly_bp
from backend.routes.forecast_routes import forecast_bp
from backend.routes.incident_routes import incident_bp
from backend.routes.task_routes import task_bp
from backend.routes.setting_routes import setting_bp
from backend.models import MonitoredTarget, NetworkMetric, User, AppSetting
from backend.services.monitoring_service import MonitoringService
from backend.services.anomaly_service import AnomalyService
import datetime

_worker_started = False
_worker_stop_event = threading.Event()

def run_background_monitor(app):
    """
    Background worker that runs in a controlled thread,
    iterating through enabled targets and probing them according to their interval.
    """
    last_check_times = {}

    with app.app_context():
        print("[NetPulse Background Monitor] Worker thread started.")

    while not _worker_stop_event.is_set():
        try:
            with app.app_context():
                targets = MonitoredTarget.query.filter_by(is_enabled=True).all()
                now = time.time()

                for target in targets:
                    last_check = last_check_times.get(target.id, 0)
                    if now - last_check >= target.interval_sec:
                        last_check_times[target.id] = now
                        
                        # Execute probe
                        ping_res = None
                        http_res = None
                        errors = []

                        if target.target_type in ('ICMP', 'DUAL'):
                            ping_res = MonitoringService.ping_host(target.hostname, count=2, timeout_sec=target.timeout_sec)
                            if ping_res.get('error'):
                                errors.append(ping_res['error'])

                        if target.target_type in ('HTTP', 'DUAL') and target.http_url:
                            http_res = MonitoringService.check_http(target.http_url, timeout_sec=target.timeout_sec)
                            if http_res.get('error'):
                                errors.append(http_res['error'])

                        # Calculate reachability
                        is_reachable = True
                        lat = None
                        loss = 0.0

                        if ping_res:
                            lat = ping_res['latency_ms']
                            loss = ping_res['packet_loss_pct']
                            if not ping_res['reachable']:
                                is_reachable = False
                        elif http_res:
                            lat = http_res['response_time_ms']
                            if not http_res['reachable']:
                                is_reachable = False

                        if not is_reachable:
                            target.status = 'DOWN'
                        elif (lat and lat >= target.warning_threshold_ms) or loss > 0:
                            target.status = 'DEGRADED'
                        else:
                            target.status = 'UP'

                        target.updated_at = datetime.datetime.utcnow()

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

                        # Evaluate statistical anomaly
                        AnomalyService.evaluate_metric(target, metric)

        except Exception as e:
            print(f"[NetPulse Monitor Error]: {e}")

        # Sleep in small slices to respond to stop event
        for _ in range(5):
            if _worker_stop_event.is_set():
                break
            time.sleep(1)


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Enable CORS for frontend Vite dev server (5173 / 3000)
    CORS(app, supports_credentials=True, origins=[
        'http://localhost:5173', 'http://127.0.0.1:5173',
        'http://localhost:3000', 'http://127.0.0.1:3000'
    ])

    db.init_app(app)

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(target_bp)
    app.register_blueprint(metric_bp)
    app.register_blueprint(anomaly_bp)
    app.register_blueprint(forecast_bp)
    app.register_blueprint(incident_bp)
    app.register_blueprint(task_bp)
    app.register_blueprint(setting_bp)

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Resource not found'}), 404

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'service': 'NetPulse Network Monitoring Backend',
            'timestamp': datetime.datetime.utcnow().isoformat()
        }), 200

    # Start background thread once when not testing
    global _worker_started
    if not _worker_started and not app.config.get('TESTING'):
        _worker_started = True
        worker_thread = threading.Thread(target=run_background_monitor, args=(app,), daemon=True)
        worker_thread.start()

    return app

if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5000, debug=True)
