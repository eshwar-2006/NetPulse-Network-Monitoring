import numpy as np
from typing import List, Dict, Any, Optional
from backend.models import Anomaly, NetworkMetric, MonitoredTarget
from backend.extensions import db

class AnomalyService:
    MIN_OBSERVATIONS_FOR_MAD = 6
    
    @classmethod
    def evaluate_metric(cls, target: MonitoredTarget, metric: NetworkMetric) -> List[Anomaly]:
        """
        Runs explainable statistical and rule-based anomaly detection on a newly collected metric.
        Returns newly generated Anomaly records (persisted to db if not duplicated).
        """
        detected_anomalies = []
        
        # 1. Reachability & Consecutive Failures
        if not metric.is_reachable or metric.packet_loss_pct >= 100.0:
            # Check recent consecutive failures
            recent_metrics = NetworkMetric.query.filter_by(target_id=target.id)\
                .order_by(NetworkMetric.timestamp.desc()).limit(3).all()
            consecutive_failures = sum(1 for m in recent_metrics if not m.is_reachable or m.packet_loss_pct >= 100.0)
            
            if consecutive_failures >= 3:
                existing = Anomaly.query.filter_by(
                    target_id=target.id,
                    detection_method='CONSECUTIVE_FAILURES',
                    is_resolved=False
                ).first()
                if not existing:
                    anomaly = Anomaly(
                        target_id=target.id,
                        metric_id=metric.id,
                        severity='CRITICAL',
                        detection_method='CONSECUTIVE_FAILURES',
                        observed_value=float(consecutive_failures),
                        baseline_value=0.0,
                        threshold_value=3.0,
                        explanation=f"Target {target.name} has suffered {consecutive_failures} consecutive probe failures. Host is fully unreachable."
                    )
                    db.session.add(anomaly)
                    detected_anomalies.append(anomaly)
                    
        # 2. Abnormal Packet Loss Check (> 5%)
        if 0.0 < metric.packet_loss_pct < 100.0:
            severity = 'CRITICAL' if metric.packet_loss_pct >= 30.0 else ('HIGH' if metric.packet_loss_pct >= 15.0 else 'WARNING')
            existing = Anomaly.query.filter_by(
                target_id=target.id,
                detection_method='PACKET_LOSS_SPIKE',
                is_resolved=False
            ).first()
            if not existing:
                anomaly = Anomaly(
                    target_id=target.id,
                    metric_id=metric.id,
                    severity=severity,
                    detection_method='PACKET_LOSS_SPIKE',
                    observed_value=metric.packet_loss_pct,
                    baseline_value=0.0,
                    threshold_value=5.0,
                    explanation=f"Abnormal packet loss of {metric.packet_loss_pct:.1f}% detected (threshold: 5.0%). Possible network congestion or dropped hops."
                )
                db.session.add(anomaly)
                detected_anomalies.append(anomaly)

        # 3. Static Latency Threshold Check
        if metric.ping_latency_ms is not None:
            if metric.ping_latency_ms >= target.critical_threshold_ms:
                existing = Anomaly.query.filter_by(
                    target_id=target.id,
                    detection_method='STATIC_THRESHOLD',
                    is_resolved=False
                ).first()
                if not existing:
                    anomaly = Anomaly(
                        target_id=target.id,
                        metric_id=metric.id,
                        severity='CRITICAL',
                        detection_method='STATIC_THRESHOLD',
                        observed_value=metric.ping_latency_ms,
                        baseline_value=target.warning_threshold_ms,
                        threshold_value=target.critical_threshold_ms,
                        explanation=f"Ping latency {metric.ping_latency_ms:.1f}ms breached critical ceiling of {target.critical_threshold_ms:.1f}ms."
                    )
                    db.session.add(anomaly)
                    detected_anomalies.append(anomaly)
            elif metric.ping_latency_ms >= target.warning_threshold_ms:
                existing = Anomaly.query.filter_by(
                    target_id=target.id,
                    detection_method='STATIC_THRESHOLD',
                    is_resolved=False
                ).first()
                if not existing:
                    anomaly = Anomaly(
                        target_id=target.id,
                        metric_id=metric.id,
                        severity='WARNING',
                        detection_method='STATIC_THRESHOLD',
                        observed_value=metric.ping_latency_ms,
                        baseline_value=target.warning_threshold_ms / 2,
                        threshold_value=target.warning_threshold_ms,
                        explanation=f"Ping latency {metric.ping_latency_ms:.1f}ms exceeded warning threshold of {target.warning_threshold_ms:.1f}ms."
                    )
                    db.session.add(anomaly)
                    detected_anomalies.append(anomaly)

        # 4. Statistical Anomaly Detection via Rolling Median and MAD (Median Absolute Deviation)
        if metric.ping_latency_ms is not None:
            recent_latencies = [
                m.ping_latency_ms for m in NetworkMetric.query.filter(
                    NetworkMetric.target_id == target.id,
                    NetworkMetric.ping_latency_ms.isnot(None),
                    NetworkMetric.is_reachable == True
                ).order_by(NetworkMetric.timestamp.desc()).limit(30).all()
            ]
            
            if len(recent_latencies) >= cls.MIN_OBSERVATIONS_FOR_MAD:
                arr = np.array(recent_latencies)
                median_val = float(np.median(arr))
                mad_val = float(np.median(np.abs(arr - median_val)))
                
                # If MAD is near 0 (very consistent baseline), use a minimum jitter buffer of 1.0ms
                effective_mad = max(mad_val, 1.0)
                
                # Modified Z-score: 0.6745 * (x - median) / MAD
                mod_z = 0.6745 * (metric.ping_latency_ms - median_val) / effective_mad
                
                # Threshold of 3.5 is standard for statistical anomaly detection using MAD
                if mod_z >= 3.5:
                    existing = Anomaly.query.filter_by(
                        target_id=target.id,
                        detection_method='ROLLING_MAD',
                        is_resolved=False
                    ).first()
                    if not existing:
                        severity = 'CRITICAL' if mod_z >= 6.0 else ('HIGH' if mod_z >= 4.5 else 'WARNING')
                        anomaly = Anomaly(
                            target_id=target.id,
                            metric_id=metric.id,
                            severity=severity,
                            detection_method='ROLLING_MAD',
                            observed_value=round(metric.ping_latency_ms, 2),
                            baseline_value=round(median_val, 2),
                            threshold_value=round(median_val + (3.5 * effective_mad / 0.6745), 2),
                            explanation=(
                                f"Statistical latency outlier detected via Rolling MAD: observed {metric.ping_latency_ms:.1f}ms "
                                f"against historical median {median_val:.1f}ms (MAD: {effective_mad:.2f}ms, "
                                f"Modified Z-Score: {mod_z:.2f} > 3.5)."
                            )
                        )
                        db.session.add(anomaly)
                        detected_anomalies.append(anomaly)
                        
        if detected_anomalies:
            db.session.commit()
            
        return detected_anomalies
