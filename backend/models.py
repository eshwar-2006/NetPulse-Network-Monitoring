import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from backend.extensions import db

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='TECHNICIAN')  # ADMIN or TECHNICIAN
    full_name = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'full_name': self.full_name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class MonitoredTarget(db.Model):
    __tablename__ = 'monitored_targets'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    hostname = db.Column(db.String(255), nullable=False, index=True)
    http_url = db.Column(db.String(512), nullable=True)
    target_type = db.Column(db.String(20), nullable=False, default='DUAL')  # ICMP, HTTP, DUAL
    interval_sec = db.Column(db.Integer, nullable=False, default=15)
    timeout_sec = db.Column(db.Integer, nullable=False, default=3)
    warning_threshold_ms = db.Column(db.Float, nullable=False, default=150.0)
    critical_threshold_ms = db.Column(db.Float, nullable=False, default=300.0)
    is_enabled = db.Column(db.Boolean, nullable=False, default=True)
    status = db.Column(db.String(20), nullable=False, default='UNKNOWN')  # UP, DOWN, DEGRADED, UNKNOWN, CHECKING
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    metrics = db.relationship('NetworkMetric', backref='target', lazy='dynamic', cascade='all, delete-orphan')
    anomalies = db.relationship('Anomaly', backref='target', lazy='dynamic', cascade='all, delete-orphan')
    incidents = db.relationship('Incident', backref='target', lazy='dynamic')

    def to_dict(self, last_metric=None):
        return {
            'id': self.id,
            'name': self.name,
            'hostname': self.hostname,
            'http_url': self.http_url,
            'target_type': self.target_type,
            'interval_sec': self.interval_sec,
            'timeout_sec': self.timeout_sec,
            'warning_threshold_ms': self.warning_threshold_ms,
            'critical_threshold_ms': self.critical_threshold_ms,
            'is_enabled': self.is_enabled,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_latency_ms': last_metric.ping_latency_ms if last_metric else None,
            'last_packet_loss': last_metric.packet_loss_pct if last_metric else None,
            'last_http_time_ms': last_metric.http_response_time_ms if last_metric else None,
            'last_check_time': last_metric.timestamp.isoformat() if last_metric else None
        }


class NetworkMetric(db.Model):
    __tablename__ = 'network_metrics'
    id = db.Column(db.Integer, primary_key=True)
    target_id = db.Column(db.Integer, db.ForeignKey('monitored_targets.id', ondelete='CASCADE'), nullable=False, index=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    ping_latency_ms = db.Column(db.Float, nullable=True)
    packet_loss_pct = db.Column(db.Float, nullable=False, default=0.0)
    http_status_code = db.Column(db.Integer, nullable=True)
    http_response_time_ms = db.Column(db.Float, nullable=True)
    is_reachable = db.Column(db.Boolean, nullable=False, default=True)
    method_used = db.Column(db.String(20), nullable=False, default='ICMP')
    error_message = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'target_id': self.target_id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'ping_latency_ms': self.ping_latency_ms,
            'packet_loss_pct': self.packet_loss_pct,
            'http_status_code': self.http_status_code,
            'http_response_time_ms': self.http_response_time_ms,
            'is_reachable': self.is_reachable,
            'method_used': self.method_used,
            'error_message': self.error_message
        }


class Anomaly(db.Model):
    __tablename__ = 'anomalies'
    id = db.Column(db.Integer, primary_key=True)
    target_id = db.Column(db.Integer, db.ForeignKey('monitored_targets.id', ondelete='CASCADE'), nullable=False, index=True)
    metric_id = db.Column(db.Integer, db.ForeignKey('network_metrics.id', ondelete='SET NULL'), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    severity = db.Column(db.String(20), nullable=False, default='WARNING')  # INFO, WARNING, HIGH, CRITICAL
    detection_method = db.Column(db.String(40), nullable=False)  # STATIC_THRESHOLD, ROLLING_MAD, CONSECUTIVE_FAILURES, etc.
    observed_value = db.Column(db.Float, nullable=True)
    baseline_value = db.Column(db.Float, nullable=True)
    threshold_value = db.Column(db.Float, nullable=True)
    explanation = db.Column(db.Text, nullable=False)
    is_acknowledged = db.Column(db.Boolean, default=False)
    is_resolved = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'target_id': self.target_id,
            'target_name': self.target.name if self.target else f"Target #{self.target_id}",
            'metric_id': self.metric_id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'severity': self.severity,
            'detection_method': self.detection_method,
            'observed_value': self.observed_value,
            'baseline_value': self.baseline_value,
            'threshold_value': self.threshold_value,
            'explanation': self.explanation,
            'is_acknowledged': self.is_acknowledged,
            'is_resolved': self.is_resolved,
            'notes': self.notes
        }


class Forecast(db.Model):
    __tablename__ = 'forecasts'
    id = db.Column(db.Integer, primary_key=True)
    target_id = db.Column(db.Integer, db.ForeignKey('monitored_targets.id', ondelete='CASCADE'), nullable=False, index=True)
    generated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    horizon_minutes = db.Column(db.Integer, nullable=False, default=30)
    model_method = db.Column(db.String(80), nullable=False, default='OLS Linear Regression')
    slope = db.Column(db.Float, nullable=True)
    intercept = db.Column(db.Float, nullable=True)
    r_squared = db.Column(db.Float, nullable=True)
    sample_size = db.Column(db.Integer, nullable=False)
    predicted_latency_ms = db.Column(db.Float, nullable=True)
    degradation_risk = db.Column(db.String(20), nullable=False, default='LOW')  # LOW, MODERATE, HIGH
    limitations_text = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'target_id': self.target_id,
            'generated_at': self.generated_at.isoformat() if self.generated_at else None,
            'horizon_minutes': self.horizon_minutes,
            'model_method': self.model_method,
            'slope': self.slope,
            'intercept': self.intercept,
            'r_squared': self.r_squared,
            'sample_size': self.sample_size,
            'predicted_latency_ms': self.predicted_latency_ms,
            'degradation_risk': self.degradation_risk,
            'limitations_text': self.limitations_text
        }


class Incident(db.Model):
    __tablename__ = 'incidents'
    id = db.Column(db.Integer, primary_key=True)
    incident_id = db.Column(db.String(40), unique=True, nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    target_id = db.Column(db.Integer, db.ForeignKey('monitored_targets.id', ondelete='SET NULL'), nullable=True)
    anomaly_id = db.Column(db.Integer, db.ForeignKey('anomalies.id', ondelete='SET NULL'), nullable=True)
    severity = db.Column(db.String(20), nullable=False, default='HIGH')  # INFO, WARNING, HIGH, CRITICAL
    status = db.Column(db.String(30), nullable=False, default='OPEN')  # OPEN, ACKNOWLEDGED, INVESTIGATING, RESOLVED, CLOSED
    assigned_to = db.Column(db.String(80), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    resolution_notes = db.Column(db.Text, nullable=True)
    resolved_at = db.Column(db.DateTime, nullable=True)

    history = db.relationship('IncidentHistory', backref='incident', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'incident_id': self.incident_id,
            'title': self.title,
            'description': self.description,
            'target_id': self.target_id,
            'target_name': self.target.name if self.target else None,
            'anomaly_id': self.anomaly_id,
            'severity': self.severity,
            'status': self.status,
            'assigned_to': self.assigned_to,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'resolution_notes': self.resolution_notes,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None
        }


class IncidentHistory(db.Model):
    __tablename__ = 'incident_history'
    id = db.Column(db.Integer, primary_key=True)
    incident_id = db.Column(db.Integer, db.ForeignKey('incidents.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    action = db.Column(db.String(100), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'incident_id': self.incident_id,
            'user_id': self.user_id,
            'action': self.action,
            'notes': self.notes,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }


class Milestone(db.Model):
    __tablename__ = 'milestones'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    due_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(30), nullable=False, default='IN_PROGRESS')
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    tasks = db.relationship('Task', backref='milestone', lazy='dynamic')

    def to_dict(self):
        all_tasks = self.tasks.all()
        completed = sum(1 for t in all_tasks if t.status == 'DONE')
        pct = int(round((completed / len(all_tasks) * 100))) if all_tasks else 0
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'status': self.status,
            'total_tasks': len(all_tasks),
            'completed_tasks': completed,
            'completion_pct': pct,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Task(db.Model):
    __tablename__ = 'tasks'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(180), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(30), nullable=False, default='TODO')  # TODO, IN_PROGRESS, BLOCKED, DONE
    priority = db.Column(db.String(20), nullable=False, default='MEDIUM')  # LOW, MEDIUM, HIGH, URGENT
    assignee = db.Column(db.String(80), nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    due_date = db.Column(db.Date, nullable=True)
    milestone_id = db.Column(db.Integer, db.ForeignKey('milestones.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'priority': self.priority,
            'assignee': self.assignee,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'milestone_id': self.milestone_id,
            'milestone_title': self.milestone.title if self.milestone else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class AppSetting(db.Model):
    __tablename__ = 'app_settings'
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(80), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=False)
    description = db.Column(db.String(255), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'key': self.key,
            'value': self.value,
            'description': self.description,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
