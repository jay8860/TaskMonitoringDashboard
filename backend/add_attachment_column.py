import sqlite3

# Define database path
DB_PATH = "data/tasks.db"

def add_column():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(tasks)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "attachment_data" not in columns:
            print("Adding 'attachment_data' column...")
            cursor.execute("ALTER TABLE tasks ADD COLUMN attachment_data TEXT")
            conn.commit()
            print("Success!")
        else:
            print("'attachment_data' column already exists.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    add_column()
