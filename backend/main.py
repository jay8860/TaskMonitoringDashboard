from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import engine, Base, SessionLocal
from routers import tasks, auth
import os
from apscheduler.schedulers.background import BackgroundScheduler
import ingester

# Create Tables
Base.metadata.create_all(bind=engine)

# --- Auto-Migration: Add is_pinned column if missing ---
from sqlalchemy import text
def run_migrations():
    try:
        with engine.connect() as connection:
            result = connection.execute(text("PRAGMA table_info(tasks)"))
            columns = [row[1] for row in result.fetchall()]
            if "is_pinned" not in columns:
                print("🔄 Migration: Adding 'is_pinned' column to tasks table...")
                connection.execute(text("ALTER TABLE tasks ADD COLUMN is_pinned INTEGER DEFAULT 0"))
                connection.commit()
                print("✅ Migration: 'is_pinned' column added.")
            else:
                print("✅ Migration: 'is_pinned' column already exists.")
    except Exception as e:
        print(f"❌ Migration Error: {e}")

run_migrations()

# Seed Admin User
from seed_auth import seed_admin
seed_admin()

# --- Auto-Sync Scheduler ---
def auto_sync_job():
    print("⏰ Auto-Sync: Starting scheduled sync...")
    db = SessionLocal()
    try:
        result = ingester.sync_data(db)
        print(f"⏰ Auto-Sync Result: {result}")
    except Exception as e:
        print(f"❌ Auto-Sync Failed: {e}")
    finally:
        db.close()

scheduler = BackgroundScheduler()
scheduler.add_job(auto_sync_job, 'interval', seconds=60)
scheduler.start()

app = FastAPI(title="Task Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://127.0.0.1:5174", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(auth.router, prefix="/api")

# Register Employees Router
from routers import employees
app.include_router(employees.router, prefix="/api/employees", tags=["employees"])

# Serve React Frontend (Single Service Mode)
frontend_dist = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../frontend/dist")

if os.path.exists(frontend_dist):
    # Mount assets folder (JS/CSS)
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    # Serve index.html for all other routes (SPA fallback)
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        # Allow API calls to pass through (though they should be caught by router above)
        if full_path.startswith("api"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="API Endpoint not found")
        
        return FileResponse(os.path.join(frontend_dist, "index.html"))

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Task Dashboard API"}
