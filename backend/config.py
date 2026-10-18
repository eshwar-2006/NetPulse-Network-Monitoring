import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'netpulse-secure-college-secret-key-2026')
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL', f"sqlite:///{os.path.join(BASE_DIR, 'netpulse.sqlite')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = timedelta(days=1)
    
    # Monitoring Defaults
    DEFAULT_MONITOR_INTERVAL = int(os.environ.get('DEFAULT_MONITOR_INTERVAL', '15'))  # seconds
    DEFAULT_TIMEOUT = int(os.environ.get('DEFAULT_TIMEOUT', '3'))  # seconds
    LATENCY_WARNING_MS = float(os.environ.get('LATENCY_WARNING_MS', '150.0'))
    LATENCY_CRITICAL_MS = float(os.environ.get('LATENCY_CRITICAL_MS', '300.0'))
    PACKET_LOSS_CRITICAL = float(os.environ.get('PACKET_LOSS_CRITICAL', '5.0'))  # %
