from database import SessionLocal
from models import User

db = SessionLocal()
users = db.query(User).all()
print(f"Found {len(users)} users.")
for u in users:
    print(f"User: {u.username}, Role: {u.role}, Email: {u.email}")
db.close()
