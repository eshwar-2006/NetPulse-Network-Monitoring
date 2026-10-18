import numpy as np
import datetime
from typing import Dict, Any, List, Optional
from backend.models import NetworkMetric, MonitoredTarget, Forecast
from backend.extensions import db

class ForecastingService:
    MIN_OBSERVATIONS = 10  # Minimum valid historical data points required

    @classmethod
    def generate_forecast(cls, target_id: int, horizon_minutes: int = 30) -> Dict[str, Any]:
        """
        Calculates explainable time-series trend forecasting using Ordinary Least Squares (OLS) Linear Regression.
        Predicts latency at the specified horizon, identifies potential threshold breach,
        and provides full statistical transparency and caveats.
        """
        target = MonitoredTarget.query.get(target_id)
        if not target:
            return {'success': False, 'error': f"Target #{target_id} not found"}

        # Fetch recent metrics with valid latency measurements
        metrics = NetworkMetric.query.filter(
            NetworkMetric.target_id == target_id,
            NetworkMetric.ping_latency_ms.isnot(None),
            NetworkMetric.is_reachable == True
        ).order_by(NetworkMetric.timestamp.asc()).limit(150).all()

        if len(metrics) < cls.MIN_OBSERVATIONS:
            return {
                'success': False,
                'error': f"Insufficient historical data: {len(metrics)} of {cls.MIN_OBSERVATIONS} required measurements collected for {target.name}.",
                'sample_size': len(metrics),
                'required_size': cls.MIN_OBSERVATIONS
            }

        # Convert timestamps to relative seconds from the first measurement
        start_ts = metrics[0].timestamp.timestamp()
        x_sec = np.array([m.timestamp.timestamp() - start_ts for m in metrics], dtype=float)
        y_lat = np.array([m.ping_latency_ms for m in metrics], dtype=float)

        # OLS Linear Regression: y = m*x + c
        n = len(x_sec)
        mean_x = np.mean(x_sec)
        mean_y = np.mean(y_lat)

        ss_xy = np.sum((x_sec - mean_x) * (y_lat - mean_y))
        ss_xx = np.sum((x_sec - mean_x) ** 2)

        if ss_xx == 0:
            slope = 0.0
            intercept = mean_y
            r_squared = 0.0
        else:
            slope = float(ss_xy / ss_xx)
            intercept = float(mean_y - slope * mean_x)
            
            # Compute R²
            y_pred_hist = slope * x_sec + intercept
            ss_tot = np.sum((y_lat - mean_y) ** 2)
            ss_res = np.sum((y_lat - y_pred_hist) ** 2)
            r_squared = float(1.0 - (ss_res / ss_tot)) if ss_tot > 0 else 0.0
            r_squared = max(0.0, min(1.0, r_squared))

        # Current time and future horizon timestamp
        last_metric_ts = metrics[-1].timestamp.timestamp()
        now_ts = datetime.datetime.utcnow().timestamp()
        horizon_sec = horizon_minutes * 60
        target_future_x = (now_ts + horizon_sec) - start_ts

        predicted_latency = max(0.1, slope * target_future_x + intercept)

        # Generate future point series for visualization (e.g. 5 steps into the horizon)
        forecast_points = []
        step_count = 6
        step_sec = horizon_sec / (step_count - 1)
        for i in range(step_count):
            future_point_ts = now_ts + (i * step_sec)
            future_x = future_point_ts - start_ts
            val = max(0.1, slope * future_x + intercept)
            forecast_points.append({
                'timestamp': datetime.datetime.utcfromtimestamp(future_point_ts).isoformat(),
                'predicted_latency_ms': round(float(val), 2),
                'is_forecast': True
            })

        # Assess degradation risk
        if predicted_latency >= target.critical_threshold_ms:
            risk = 'HIGH'
            risk_desc = f"Predicted latency ({predicted_latency:.1f}ms) exceeds Critical Threshold ({target.critical_threshold_ms:.1f}ms) within {horizon_minutes} minutes."
        elif predicted_latency >= target.warning_threshold_ms:
            risk = 'MODERATE'
            risk_desc = f"Predicted latency ({predicted_latency:.1f}ms) exceeds Warning Threshold ({target.warning_threshold_ms:.1f}ms) within {horizon_minutes} minutes."
        elif slope > 0.05:
            risk = 'MODERATE'
            risk_desc = f"Positive latency drift (+{slope*60:.2f}ms/min). System is trending towards degradation."
        else:
            risk = 'LOW'
            risk_desc = "Stable trend. Latency expected to remain within normal operational bounds."

        limitations = (
            f"Model assumes linear progression based on {n} historical measurements over the past window. "
            f"Linear extrapolation does not capture sudden ISP routing changes, transient link saturations, "
            f"or hardware failures. Forecasts are statistical approximations, not absolute performance guarantees."
        )

        # Persist forecast record
        forecast_record = Forecast(
            target_id=target_id,
            generated_at=datetime.datetime.utcnow(),
            horizon_minutes=horizon_minutes,
            model_method='OLS Univariate Linear Regression',
            slope=round(slope, 6),
            intercept=round(intercept, 4),
            r_squared=round(r_squared, 4),
            sample_size=n,
            predicted_latency_ms=round(predicted_latency, 2),
            degradation_risk=risk,
            limitations_text=limitations
        )
        db.session.add(forecast_record)
        db.session.commit()

        # Format historical points for charts
        historical_points = [
            {
                'timestamp': m.timestamp.isoformat(),
                'latency_ms': round(m.ping_latency_ms, 2) if m.ping_latency_ms else None,
                'is_forecast': False
            } for m in metrics[-30:]  # Last 30 points
        ]

        return {
            'success': True,
            'forecast_id': forecast_record.id,
            'target_id': target_id,
            'target_name': target.name,
            'horizon_minutes': horizon_minutes,
            'model_method': 'OLS Univariate Linear Regression',
            'slope_per_minute': round(slope * 60, 4),
            'intercept': round(intercept, 2),
            'r_squared': round(r_squared, 4),
            'sample_size': n,
            'current_latency_ms': round(metrics[-1].ping_latency_ms, 2) if metrics[-1].ping_latency_ms else None,
            'predicted_latency_ms': round(predicted_latency, 2),
            'degradation_risk': risk,
            'risk_description': risk_desc,
            'warning_threshold_ms': target.warning_threshold_ms,
            'critical_threshold_ms': target.critical_threshold_ms,
            'limitations_text': limitations,
            'generated_at': forecast_record.generated_at.isoformat(),
            'historical_points': historical_points,
            'forecast_points': forecast_points
        }
