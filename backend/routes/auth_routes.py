from flask import Blueprint, request, jsonify, session
from functools import wraps
from backend.models import User
from backend.extensions import db

auth_bp = Blueprint('auth_bp', __name__, url_prefix='/api/v1/auth')

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Authentication required. Please sign in.'}), 401
        current_user = User.query.get(user_id)
        if not current_user:
            session.clear()
            return jsonify({'error': 'Invalid session user'}), 401
        return f(current_user, *args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Authentication required. Please sign in.'}), 401
        current_user = User.query.get(user_id)
        if not current_user or current_user.role != 'ADMIN':
            return jsonify({'error': 'Forbidden. Administrator privileges required.'}), 403
        return f(current_user, *args, **kwargs)
    return decorated_function

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    role = data.get('role', 'TECHNICIAN').upper()
    full_name = data.get('full_name', '').strip()

    if not username or len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters long.'}), 400
    if not email or '@' not in email:
        return jsonify({'error': 'Valid email is required.'}), 400
    if not password or len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters long.'}), 400
    if role not in ('ADMIN', 'TECHNICIAN'):
        role = 'TECHNICIAN'

    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify({'error': 'Username or email already in use.'}), 409

    user = User(username=username, email=email, role=role, full_name=full_name)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    # Automatically log the user in
    session['user_id'] = user.id
    session['username'] = user.username
    session['role'] = user.role
    session.permanent = True

    return jsonify({
        'message': 'Registration successful',
        'user': user.to_dict()
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username_or_email = data.get('username', '').strip()
    password = data.get('password', '')

    if not username_or_email or not password:
        return jsonify({'error': 'Username/email and password required.'}), 400

    user = User.query.filter(
        (User.username == username_or_email) | (User.email == username_or_email.lower())
    ).first()

    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials.'}), 401

    session['user_id'] = user.id
    session['username'] = user.username
    session['role'] = user.role
    session.permanent = True

    return jsonify({
        'message': 'Login successful',
        'user': user.to_dict()
    }), 200

@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200

@auth_bp.route('/me', methods=['GET'])
def me():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'authenticated': False, 'user': None}), 200
    user = User.query.get(user_id)
    if not user:
        session.clear()
        return jsonify({'authenticated': False, 'user': None}), 200
    return jsonify({
        'authenticated': True,
        'user': user.to_dict()
    }), 200
