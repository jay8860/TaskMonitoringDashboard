from sqlalchemy.orm import Session
from sqlalchemy import text
from database import SessionLocal, engine, Base
import models
from routers.auth import get_password_hash

# Ensure tables exist
Base.metadata.create_all(bind=engine)

def migrate_db(db: Session):
    """
    Manually add columns that might be missing if the table was created before the model update.
    Checking for PostgreSQL syntax mostly, but generic SQL attempts.
    """
    try:
        # Try adding columns. Fails if they exist (without IF NOT EXISTS on older SQL versions), so we wrap in try/except individually or use IF NOT EXISTS
        # Railway uses Postgres, so IF NOT EXISTS is safe.
        with engine.connect() as connection:
            with connection.begin():
                connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR;"))
                connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hint VARCHAR;"))
                connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR;"))
                connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;"))
        print("Database migration checks completed.")
    except Exception as e:
        print(f"Migration step error (ignorable if columns exist): {e}")

def seed_admin():
    db = SessionLocal()
    try:
        # Run Migration First
        migrate_db(db)

        username = "admin"
        email = "jayant.nahata@alumni.iitd.ac.in"
        password = "admin123"
        hint = "Default: admin123"
        
        user = db.query(models.User).filter(models.User.username == username).first()
        if not user:
            print(f"Creating default admin user: {username}")
            new_user = models.User(
                username=username,
                hashed_password=get_password_hash(password),
                role="admin",
                email=email,
                password_hint=hint
            )
            db.add(new_user)
            db.commit()
            print("Admin user created successfully.")
        else:
            print(f"Admin user {username} exists. Updating credentials to ensure access.")
            user.email = email
            user.password_hint = hint
            # Always reset password to ensure known state if user is locked out
            user.hashed_password = get_password_hash(password)
            db.commit()
            print("Admin user credentials updated.")

    except Exception as e:
        print(f"Error seeding admin: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
