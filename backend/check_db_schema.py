import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "tasks.db")

print(f"Checking Database at: {DB_PATH}")

if not os.path.exists(DB_PATH):
    print("Database file NOT FOUND!")
    exit()

try:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("PRAGMA table_info(tasks)")
    columns = cursor.fetchall()
    
    print(f"Found {len(columns)} columns:")
    found = False
    for col in columns:
        print(f"- {col[1]} ({col[2]})")
        if col[1] == "scheduled_date":
            found = True
            
    if found:
        print("\nSUCCESS: 'scheduled_date' column EXISTS.")
    else:
        print("\nFAILURE: 'scheduled_date' column MISSING!")

    conn.close()
except Exception as e:
    print(f"Error: {e}")
