import sys
import os
import datetime
import random

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.app import create_app
from backend.extensions import db
from backend.models import User, MonitoredTarget, NetworkMetric, Anomaly, Milestone, Task, AppSetting, Incident

def seed_database():
    app = create_app()
    with app.app_context():
        db.create_all()

        # 1. Seed Admin and Technician users
        if not User.query.filter_by(username='admin').first():
            admin = User(
                username='admin',
                email='admin@netpulse.local',
                role='ADMIN',
                full_name='Lead NOC Admin'
            )
            admin.set_password('AdminPass123!')
            db.session.add(admin)

        if not User.query.filter_by(username='technician').first():
            tech = User(
                username='technician',
                email='tech@netpulse.local',
                role='TECHNICIAN',
                full_name='Field Operations Engineer'
            )
            tech.set_password('TechPass123!')
            db.session.add(tech)

        db.session.commit()

        # 2. Seed Real Network Targets
        targets_data = [
            {
                'name': 'Cloudflare Public DNS',
                'hostname': '1.1.1.1',
                'http_url': 'https://1.1.1.1',
                'target_type': 'DUAL',
                'interval_sec': 15,
                'timeout_sec': 3,
                'warning_threshold_ms': 60.0,
                'critical_threshold_ms': 150.0,
                'base_lat': 12.0
            },
            {
                'name': 'Google Primary DNS',
                'hostname': '8.8.8.8',
                'http_url': 'https://dns.google',
                'target_type': 'DUAL',
                'interval_sec': 15,
                'timeout_sec': 3,
                'warning_threshold_ms': 80.0,
                'critical_threshold_ms': 200.0,
                'base_lat': 18.5
            },
            {
                'name': 'Quad9 Anycast Resolver',
                'hostname': '9.9.9.9',
                'http_url': 'https://quad9.net',
                'target_type': 'DUAL',
                'interval_sec': 20,
                'timeout_sec': 4,
                'warning_threshold_ms': 75.0,
                'critical_threshold_ms': 180.0,
                'base_lat': 22.0
            },
            {
                'name': 'GitHub API Endpoint',
                'hostname': 'api.github.com',
                'http_url': 'https://api.github.com',
                'target_type': 'HTTP',
                'interval_sec': 30,
                'timeout_sec': 5,
                'warning_threshold_ms': 180.0,
                'critical_threshold_ms': 400.0,
                'base_lat': 45.0
            }
        ]

        now = datetime.datetime.utcnow()

        for t_info in targets_data:
            target = MonitoredTarget.query.filter_by(hostname=t_info['hostname']).first()
            if not target:
                target = MonitoredTarget(
                    name=t_info['name'],
                    hostname=t_info['hostname'],
                    http_url=t_info['http_url'],
                    target_type=t_info['target_type'],
                    interval_sec=t_info['interval_sec'],
                    timeout_sec=t_info['timeout_sec'],
                    warning_threshold_ms=t_info['warning_threshold_ms'],
                    critical_threshold_ms=t_info['critical_threshold_ms'],
                    is_enabled=True,
                    status='UP'
                )
                db.session.add(target)
                db.session.flush()

                # Seed historical baseline measurements (past 2 hours, 20 points)
                base = t_info['base_lat']
                for i in range(20, 0, -1):
                    ts = now - datetime.timedelta(minutes=i * 5)
                    jitter = random.uniform(-2.5, 3.5)
                    lat = max(2.0, base + jitter)
                    metric = NetworkMetric(
                        target_id=target.id,
                        timestamp=ts,
                        ping_latency_ms=round(lat, 2),
                        packet_loss_pct=0.0,
                        http_status_code=200 if target.http_url else None,
                        http_response_time_ms=round(lat * 1.5, 2) if target.http_url else None,
                        is_reachable=True,
                        method_used=target.target_type
                    )
                    db.session.add(metric)

        # 3. Seed Milestones and Tasks
        if not Milestone.query.first():
            m1 = Milestone(
                title="Phase 1: Core Telemetry Engine Deployment",
                description="Initialize ICMP probes, HTTP health checking, and local interface throughput monitoring.",
                due_date=(now + datetime.timedelta(days=7)).date(),
                status="IN_PROGRESS"
            )
            m2 = Milestone(
                title="Phase 2: Predictive Maintenance & Anomaly Alerting",
                description="Deploy rolling MAD statistical detector and linear regression trend forecasting engine.",
                due_date=(now + datetime.timedelta(days=14)).date(),
                status="PLANNING"
            )
            db.session.add_all([m1, m2])
            db.session.flush()

            tasks = [
                Task(
                    title="Audit Network Subprocess Ping Permissions",
                    description="Ensure ICMP ping execution does not require privileged CAP_NET_RAW across deployment environments.",
                    status="DONE",
                    priority="HIGH",
                    assignee="admin",
                    milestone_id=m1.id
                ),
                Task(
                    title="Validate psutil Interface Delta Counters",
                    description="Implement safeguards against interface reboots and counter rollover.",
                    status="DONE",
                    priority="MEDIUM",
                    assignee="technician",
                    milestone_id=m1.id
                ),
                Task(
                    title="Calibrate Rolling MAD Outlier Sensitivity",
                    description="Tune modified Z-score thresholds to minimize false positive spikes during burst traffic.",
                    status="IN_PROGRESS",
                    priority="HIGH",
                    assignee="admin",
                    milestone_id=m2.id
                ),
                Task(
                    title="Integrate Incident Escalation Workflow",
                    description="Allow automated ticket dispatch when critical anomaly thresholds persist for > 3 intervals.",
                    status="TODO",
                    priority="MEDIUM",
                    assignee="technician",
                    milestone_id=m2.id
                )
            ]
            db.session.add_all(tasks)

        db.session.commit()
        print("[+] NetPulse database successfully initialized and seeded with baseline data!")

if __name__ == '__main__':
    seed_database()
