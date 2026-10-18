import pytest
import datetime
from unittest.mock import patch, MagicMock
from backend.app import create_app
from backend.extensions import db
from backend.models import User, MonitoredTarget, NetworkMetric, Anomaly, Incident, Milestone, Task
from backend.services.monitoring_service import MonitoringService
from backend.services.anomaly_service import AnomalyService
from backend.services.forecasting_service import ForecastingService

class TestConfig:
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = 'test-secret-key'

@pytest.fixture
def app():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def auth_admin(app, client):
    with app.app_context():
        admin = User(username='admin_test', email='adm@test.com', role='ADMIN', full_name='Admin Test')
        admin.set_password('Admin123!')
        db.session.add(admin)
        db.session.commit()
    client.post('/api/v1/auth/login', json={'username': 'admin_test', 'password': 'Admin123!'})
    return client

@pytest.fixture
def auth_tech(app, client):
    with app.app_context():
        tech = User(username='tech_test', email='tech@test.com', role='TECHNICIAN', full_name='Tech Test')
        tech.set_password('Tech123!')
        db.session.add(tech)
        db.session.commit()
    client.post('/api/v1/auth/login', json={'username': 'tech_test', 'password': 'Tech123!'})
    return client

# 1. Database & User Registration / Auth Tests
def test_user_registration_and_login(client):
    res = client.post('/api/v1/auth/register', json={
        'username': 'newuser',
        'email': 'new@test.com',
        'password': 'Password123!',
        'role': 'TECHNICIAN'
    })
    assert res.status_code == 201
    assert res.get_json()['user']['username'] == 'newuser'

    # Me check
    me_res = client.get('/api/v1/auth/me')
    assert me_res.status_code == 200
    assert me_res.get_json()['authenticated'] is True

    # Logout
    logout_res = client.post('/api/v1/auth/logout')
    assert logout_res.status_code == 200

    # Me after logout
    me_after = client.get('/api/v1/auth/me')
    assert me_after.get_json()['authenticated'] is False

def test_role_based_access(auth_tech, auth_admin, app):
    with app.app_context():
        target = MonitoredTarget(name='Target1', hostname='127.0.0.1')
        db.session.add(target)
        db.session.commit()
        t_id = target.id

    # Technician attempting admin-only DELETE should be forbidden (403)
    del_res_tech = auth_tech.delete(f'/api/v1/targets/{t_id}')
    assert del_res_tech.status_code == 403

    # Admin attempting delete should succeed (200)
    del_res_admin = auth_admin.delete(f'/api/v1/targets/{t_id}')
    assert del_res_admin.status_code == 200

# 2. Target Validation & CRUD
def test_target_validation(auth_admin):
    # Invalid host
    res = auth_admin.post('/api/v1/targets', json={'name': 'Bad', 'hostname': 'invalid space! host'})
    assert res.status_code == 400

    # Valid target
    res_ok = auth_admin.post('/api/v1/targets', json={
        'name': 'Cloudflare DNS',
        'hostname': '1.1.1.1',
        'http_url': 'https://1.1.1.1',
        'target_type': 'DUAL',
        'interval_sec': 15,
        'warning_threshold_ms': 50.0,
        'critical_threshold_ms': 100.0
    })
    assert res_ok.status_code == 201
    assert res_ok.get_json()['target']['name'] == 'Cloudflare DNS'

# 3. Mocked ICMP & HTTP Monitoring Result Handling
@patch('subprocess.run')
def test_ping_host_parsing_success(mock_sub):
    mock_sub.return_value = MagicMock(
        returncode=0,
        stdout="rtt min/avg/max/mdev = 12.110/15.340/18.220/1.550 ms\n3 packets transmitted, 3 received, 0% packet loss",
        stderr=""
    )
    res = MonitoringService.ping_host('1.1.1.1')
    assert res['reachable'] is True
    assert res['latency_ms'] == 15.34
    assert res['packet_loss_pct'] == 0.0

@patch('requests.get')
def test_http_check_success(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_get.return_value = mock_resp
    res = MonitoringService.check_http('https://1.1.1.1')
    assert res['reachable'] is True
    assert res['status_code'] == 200

# 4. Anomaly Detection & Duplicate Prevention
def test_anomaly_detection_static_and_mad(app):
    with app.app_context():
        target = MonitoredTarget(
            name='Test Target',
            hostname='8.8.8.8',
            warning_threshold_ms=50.0,
            critical_threshold_ms=100.0
        )
        db.session.add(target)
        db.session.commit()

        # Insert 15 normal baseline measurements (~15ms)
        for i in range(15):
            m = NetworkMetric(
                target_id=target.id,
                ping_latency_ms=15.0 + (i % 2),
                packet_loss_pct=0.0,
                is_reachable=True
            )
            db.session.add(m)
        db.session.commit()

        # Now insert a huge spike (180ms)
        spike_metric = NetworkMetric(
            target_id=target.id,
            ping_latency_ms=180.0,
            packet_loss_pct=0.0,
            is_reachable=True
        )
        db.session.add(spike_metric)
        db.session.commit()

        # Run anomaly evaluation
        anomalies = AnomalyService.evaluate_metric(target, spike_metric)
        assert len(anomalies) > 0
        methods = [a.detection_method for a in anomalies]
        assert 'STATIC_THRESHOLD' in methods or 'ROLLING_MAD' in methods

        # Duplicate check: running again on same state should prevent duplicates
        dup_anomalies = AnomalyService.evaluate_metric(target, spike_metric)
        assert len(dup_anomalies) == 0

# 5. Forecasting with Insufficient and Sufficient History
def test_forecasting_logic(app):
    with app.app_context():
        target = MonitoredTarget(name='Forecast Target', hostname='9.9.9.9')
        db.session.add(target)
        db.session.commit()

        # Test with insufficient history (< 10 points)
        res_insufficient = ForecastingService.generate_forecast(target.id, 30)
        assert res_insufficient['success'] is False
        assert 'Insufficient historical data' in res_insufficient['error']

        # Add 15 historical points with linear upward drift
        base_time = datetime.datetime.utcnow() - datetime.timedelta(minutes=30)
        for i in range(15):
            m = NetworkMetric(
                target_id=target.id,
                timestamp=base_time + datetime.timedelta(minutes=i * 2),
                ping_latency_ms=20.0 + (i * 1.5),  # Clear upward trend
                packet_loss_pct=0.0,
                is_reachable=True
            )
            db.session.add(m)
        db.session.commit()

        # Test with sufficient history
        res_sufficient = ForecastingService.generate_forecast(target.id, 30)
        assert res_sufficient['success'] is True
        assert res_sufficient['sample_size'] == 15
        assert res_sufficient['predicted_latency_ms'] > 40.0
        assert 'historical_points' in res_sufficient
        assert 'forecast_points' in res_sufficient

# 6. Incident Management & CSV Export
def test_incident_and_csv_export(auth_admin, app):
    with app.app_context():
        target = MonitoredTarget(name='INC Target', hostname='10.0.0.1')
        db.session.add(target)
        db.session.commit()
        t_id = target.id

    # Create incident
    inc_res = auth_admin.post('/api/v1/incidents', json={
        'title': 'Core Gateway Latency High',
        'description': 'Elevated RTT noticed on internal link.',
        'target_id': t_id,
        'severity': 'HIGH'
    })
    assert inc_res.status_code == 201
    inc_data = inc_res.get_json()['incident']
    assert inc_data['status'] == 'OPEN'

    # Update incident to INVESTIGATING
    patch_res = auth_admin.patch(f"/api/v1/incidents/{inc_data['id']}", json={
        'status': 'INVESTIGATING',
        'resolution_notes': 'Inspecting core switch queue depth.'
    })
    assert patch_res.status_code == 200
    assert patch_res.get_json()['incident']['status'] == 'INVESTIGATING'

    # Export incidents to CSV
    export_res = auth_admin.get('/api/v1/incidents/export')
    assert export_res.status_code == 200
    assert 'text/csv' in export_res.content_type
    assert b'Incident_ID,Title,Target,Severity,Status' in export_res.data
