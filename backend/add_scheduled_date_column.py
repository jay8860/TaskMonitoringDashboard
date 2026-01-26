import sqlite3
import os

# Path to database
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "tasks.db")

print(f"Migrating Database at: {DB_PATH}")

if not os.path.exists(DB_PATH):
    print("Database not found. It will be created when the app runs.")
    exit()

try:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if column exists
    cursor.execute("PRAGMA table_info(tasks)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if "scheduled_date" not in columns:
        print("Adding 'scheduled_date' column...")
        cursor.execute("ALTER TABLE tasks ADD COLUMN scheduled_date DATE")
        conn.commit()
        print("Migration Successful!")
    else:
        print("'scheduled_date' column already exists.")

    conn.close()
except Exception as e:
    print(f"Migration Failed: {e}")
