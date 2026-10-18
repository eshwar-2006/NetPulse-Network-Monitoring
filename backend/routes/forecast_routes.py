from flask import Blueprint, request, jsonify
from backend.models import Forecast, MonitoredTarget
from backend.services.forecasting_service import ForecastingService
from backend.routes.auth_routes import login_required

forecast_bp = Blueprint('forecast_bp', __name__, url_prefix='/api/v1/forecasts')

@forecast_bp.route('', methods=['GET'])
def list_forecasts():
    target_id = request.args.get('target_id', type=int)
    query = Forecast.query
    if target_id:
        query = query.filter_by(target_id=target_id)
    records = query.order_by(Forecast.generated_at.desc()).limit(20).all()
    return jsonify([f.to_dict() for f in records]), 200

@forecast_bp.route('/generate', methods=['POST'])
@login_required
def generate_forecast(current_user):
    data = request.get_json() or {}
    target_id = data.get('target_id')
    horizon_minutes = int(data.get('horizon_minutes', 30))

    if not target_id:
        return jsonify({'error': 'target_id is required.'}), 400
    if horizon_minutes not in (15, 30, 60, 120, 240):
        horizon_minutes = 30

    result = ForecastingService.generate_forecast(target_id, horizon_minutes)
    if not result.get('success'):
        return jsonify(result), 400

    return jsonify(result), 200
