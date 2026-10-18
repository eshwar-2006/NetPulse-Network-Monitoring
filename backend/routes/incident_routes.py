from flask import Blueprint, request, jsonify, Response
from backend.models import Incident, IncidentHistory, MonitoredTarget
from backend.routes.auth_routes import login_required
from backend.extensions import db
import datetime
import io
import csv
import uuid

incident_bp = Blueprint('incident_bp', __name__, url_prefix='/api/v1/incidents')

@incident_bp.route('', methods=['GET'])
def list_incidents():
    status = request.args.get('status')
    severity = request.args.get('severity')
    target_id = request.args.get('target_id', type=int)
    search = request.args.get('search', '').strip().lower()

    query = Incident.query
    if status:
        query = query.filter_by(status=status.upper())
    if severity:
        query = query.filter_by(severity=severity.upper())
    if target_id:
        query = query.filter_by(target_id=target_id)
    if search:
        query = query.filter(
            (Incident.title.ilike(f'%{search}%')) |
            (Incident.description.ilike(f'%{search}%')) |
            (Incident.incident_id.ilike(f'%{search}%'))
        )

    incidents = query.order_by(Incident.created_at.desc()).all()
    return jsonify([inc.to_dict() for inc in incidents]), 200

@incident_bp.route('', methods=['POST'])
@login_required
def create_incident(current_user):
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    target_id = data.get('target_id')
    anomaly_id = data.get('anomaly_id')
    severity = data.get('severity', 'HIGH').upper()
    assigned_to = data.get('assigned_to', '').strip() or current_user.username

    if not title:
        return jsonify({'error': 'Incident title is required.'}), 400
    if not description:
        return jsonify({'error': 'Incident description is required.'}), 400
    if severity not in ('INFO', 'WARNING', 'HIGH', 'CRITICAL'):
        severity = 'HIGH'

    # Generate friendly unique ticket ID: INC-2026-XXXX
    short_uid = uuid.uuid4().hex[:6].upper()
    incident_code = f"INC-{datetime.datetime.utcnow().year}-{short_uid}"

    incident = Incident(
        incident_id=incident_code,
        title=title,
        description=description,
        target_id=target_id,
        anomaly_id=anomaly_id,
        severity=severity,
        status='OPEN',
        assigned_to=assigned_to
    )
    db.session.add(incident)
    db.session.flush()

    # Add audit log
    history = IncidentHistory(
        incident_id=incident.id,
        user_id=current_user.id,
        action='CREATED',
        notes=f"Incident created by {current_user.username} with severity {severity}"
    )
    db.session.add(history)
    db.session.commit()

    return jsonify({
        'message': f'Incident {incident.incident_id} created successfully',
        'incident': incident.to_dict()
    }), 201

@incident_bp.route('/<int:id>', methods=['PATCH'])
@login_required
def update_incident(current_user, id):
    incident = Incident.query.get_or_404(id)
    data = request.get_json() or {}
    action_notes = []

    if 'status' in data:
        new_status = data['status'].upper()
        if new_status in ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'CLOSED'):
            action_notes.append(f"Status changed from {incident.status} to {new_status}")
            incident.status = new_status
            if new_status in ('RESOLVED', 'CLOSED') and not incident.resolved_at:
                incident.resolved_at = datetime.datetime.utcnow()

    if 'severity' in data:
        new_sev = data['severity'].upper()
        if new_sev in ('INFO', 'WARNING', 'HIGH', 'CRITICAL'):
            action_notes.append(f"Severity changed to {new_sev}")
            incident.severity = new_sev

    if 'assigned_to' in data:
        new_assignee = data['assigned_to'].strip()
        action_notes.append(f"Assignee changed to {new_assignee}")
        incident.assigned_to = new_assignee

    if 'resolution_notes' in data and data['resolution_notes']:
        note_txt = data['resolution_notes'].strip()
        existing = incident.resolution_notes or ''
        incident.resolution_notes = f"{existing}\n[{datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M')} - {current_user.username}]: {note_txt}".strip()
        action_notes.append("Added investigation / resolution notes")

    incident.updated_at = datetime.datetime.utcnow()

    if action_notes:
        history = IncidentHistory(
            incident_id=incident.id,
            user_id=current_user.id,
            action='UPDATED',
            notes="; ".join(action_notes)
        )
        db.session.add(history)

    db.session.commit()
    return jsonify({
        'message': f'Incident {incident.incident_id} updated successfully',
        'incident': incident.to_dict()
    }), 200

@incident_bp.route('/export', methods=['GET'])
def export_incidents():
    incidents = Incident.query.order_by(Incident.created_at.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Incident_ID', 'Title', 'Target', 'Severity', 'Status',
        'Assigned_To', 'Created_At', 'Updated_At', 'Resolved_At', 'Description', 'Resolution_Notes'
    ])
    for inc in incidents:
        writer.writerow([
            inc.incident_id,
            inc.title,
            inc.target.name if inc.target else 'N/A',
            inc.severity,
            inc.status,
            inc.assigned_to or 'Unassigned',
            inc.created_at.isoformat() if inc.created_at else '',
            inc.updated_at.isoformat() if inc.updated_at else '',
            inc.resolved_at.isoformat() if inc.resolved_at else '',
            inc.description,
            inc.resolution_notes or ''
        ])
    csv_data = output.getvalue()
    filename = f"netpulse_incidents_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        csv_data,
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment;filename={filename}'}
    )
