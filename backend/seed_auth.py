from sqlalchemy.orm import Session
from sqlalchemy import text
from database import SessionLocal, engine, Base
import models
from utils import get_password_hash

# Ensure tables exist
Base.metadata.create_all(bind=engine)

def migrate_db(db: Session):
    """
    Manually add columns that might be missing using SQLite-compatible checks.
    """
    try:
        with engine.connect() as connection:
            # Check existing columns
            result = connection.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]
            
            # Helper to add column if missing
            def add_column(col_name, col_type):
                if col_name not in columns:
                    print(f"🔄 Migration: Adding '{col_name}' column to users table...")
                    try:
                        connection.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                        connection.commit()
                        print(f"✅ Users Migration: '{col_name}' added.")
                    except Exception as e:
                        print(f"⚠️ Failed to add {col_name}: {e}")

            add_column("email", "VARCHAR")
            add_column("password_hint", "VARCHAR")
            add_column("reset_token", "VARCHAR")
            add_column("reset_token_expiry", "TIMESTAMP")

        print("Database migration checks completed.")
    except Exception as e:
        print(f"Migration step error: {e}")

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
