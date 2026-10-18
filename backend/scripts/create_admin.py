import sys
import os

# Add root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.app import create_app
from backend.extensions import db
from backend.models import User

def create_admin(username, email, password, full_name="System Administrator"):
    app = create_app()
    with app.app_context():
        db.create_all()
        existing = User.query.filter((User.username == username) | (User.email == email)).first()
        if existing:
            print(f"[!] User with username '{username}' or email '{email}' already exists.")
            return

        admin = User(
            username=username,
            email=email,
            role='ADMIN',
            full_name=full_name
        )
        admin.set_password(password)
        db.session.add(admin)
        db.session.commit()
        print(f"[+] Administrator account '{username}' successfully created!")

if __name__ == '__main__':
    u = sys.argv[1] if len(sys.argv) > 1 else 'admin'
    e = sys.argv[2] if len(sys.argv) > 2 else 'admin@netpulse.local'
    p = sys.argv[3] if len(sys.argv) > 3 else 'AdminPass123!'
    create_admin(u, e, p)
