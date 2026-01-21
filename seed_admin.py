from backend.database import SessionLocal, engine, Base
from backend.models import User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed():
    db = SessionLocal()
    # Check if admin exists
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        print("Seeding Admin User...")
        hashed = pwd_context.hash("admin")
        new_admin = User(username="admin", role="admin", hashed_password=hashed)
        db.add(new_admin)
        db.commit()
        print("Admin user created (admin/admin)")
    else:
        print("Admin user already exists.")
    
    # Check if a non-admin user exists
    user = db.query(User).filter(User.username == "user").first()
    if not user:
        hashed = pwd_context.hash("user")
        new_user = User(username="user", role="viewer", hashed_password=hashed)
        db.add(new_user)
        db.commit()

if __name__ == "__main__":
    seed()
