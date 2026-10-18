from flask import Blueprint, request, jsonify
from backend.models import Task, Milestone
from backend.routes.auth_routes import login_required
from backend.extensions import db
import datetime

task_bp = Blueprint('task_bp', __name__, url_prefix='/api/v1')

# --- MILESTONES ---
@task_bp.route('/milestones', methods=['GET'])
def list_milestones():
    milestones = Milestone.query.order_by(Milestone.due_date.asc().nullslast()).all()
    return jsonify([m.to_dict() for m in milestones]), 200

@task_bp.route('/milestones', methods=['POST'])
@login_required
def create_milestone(current_user):
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    due_date_str = data.get('due_date')

    if not title:
        return jsonify({'error': 'Milestone title is required.'}), 400

    due_date = None
    if due_date_str:
        try:
            due_date = datetime.datetime.strptime(due_date_str, '%Y-%m-%d').date()
        except ValueError:
            pass

    milestone = Milestone(
        title=title,
        description=description,
        due_date=due_date,
        status='IN_PROGRESS'
    )
    db.session.add(milestone)
    db.session.commit()
    return jsonify(milestone.to_dict()), 201

# --- TASKS ---
@task_bp.route('/tasks', methods=['GET'])
def list_tasks():
    status = request.args.get('status')
    priority = request.args.get('priority')
    milestone_id = request.args.get('milestone_id', type=int)

    query = Task.query
    if status:
        query = query.filter_by(status=status.upper())
    if priority:
        query = query.filter_by(priority=priority.upper())
    if milestone_id:
        query = query.filter_by(milestone_id=milestone_id)

    tasks = query.order_by(Task.due_date.asc().nullslast()).all()
    return jsonify([t.to_dict() for t in tasks]), 200

@task_bp.route('/tasks', methods=['POST'])
@login_required
def create_task(current_user):
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    status = data.get('status', 'TODO').upper()
    priority = data.get('priority', 'MEDIUM').upper()
    assignee = data.get('assignee', '').strip() or current_user.username
    milestone_id = data.get('milestone_id')
    due_date_str = data.get('due_date')

    if not title:
        return jsonify({'error': 'Task title is required.'}), 400
    if status not in ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'):
        status = 'TODO'
    if priority not in ('LOW', 'MEDIUM', 'HIGH', 'URGENT'):
        priority = 'MEDIUM'

    due_date = None
    if due_date_str:
        try:
            due_date = datetime.datetime.strptime(due_date_str, '%Y-%m-%d').date()
        except ValueError:
            pass

    task = Task(
        title=title,
        description=description,
        status=status,
        priority=priority,
        assignee=assignee,
        due_date=due_date,
        milestone_id=milestone_id
    )
    db.session.add(task)
    db.session.commit()
    return jsonify(task.to_dict()), 201

@task_bp.route('/tasks/<int:id>', methods=['PATCH'])
@login_required
def update_task(current_user, id):
    task = Task.query.get_or_404(id)
    data = request.get_json() or {}

    if 'title' in data:
        task.title = data['title'].strip()
    if 'description' in data:
        task.description = data['description'].strip()
    if 'status' in data:
        st = data['status'].upper()
        if st in ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'):
            task.status = st
    if 'priority' in data:
        pr = data['priority'].upper()
        if pr in ('LOW', 'MEDIUM', 'HIGH', 'URGENT'):
            task.priority = pr
    if 'assignee' in data:
        task.assignee = data['assignee'].strip()
    if 'milestone_id' in data:
        task.milestone_id = data['milestone_id']
    if 'due_date' in data:
        if data['due_date']:
            try:
                task.due_date = datetime.datetime.strptime(data['due_date'], '%Y-%m-%d').date()
            except ValueError:
                pass
        else:
            task.due_date = None

    task.updated_at = datetime.datetime.utcnow()
    db.session.commit()
    return jsonify(task.to_dict()), 200

@task_bp.route('/tasks/<int:id>', methods=['DELETE'])
@login_required
def delete_task(current_user, id):
    task = Task.query.get_or_404(id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({'message': f'Task #{id} deleted successfully'}), 200
