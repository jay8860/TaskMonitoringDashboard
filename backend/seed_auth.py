from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
import models
from routers.auth import get_password_hash

# Ensure tables exist
Base.metadata.create_all(bind=engine)

def seed_admin():
    db = SessionLocal()
    try:
        username = "admin"
        email = "jayant.nahata@alumni.iitd.ac.in"
        
        user = db.query(models.User).filter(models.User.username == username).first()
        if not user:
            print(f"Creating default admin user: {username}")
            new_user = models.User(
                username=username,
                hashed_password=get_password_hash("admin123"),
                role="admin",
                email=email,
                password_hint="Default password (admin...)"
            )
            db.add(new_user)
            db.commit()
            print("Admin user created successfully.")
        else:
            print(f"Admin user {username} already exists. Updating email/hint just in case.")
            user.email = email
            user.password_hint = "Default password (admin...)"
            # user.hashed_password = get_password_hash("admin123") # Uncomment to reset password
            db.commit()
            print("Admin user updated.")

    except Exception as e:
        print(f"Error seeding admin: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
