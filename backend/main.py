from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import tasks

# Create Tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Task Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://127.0.0.1:5174", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
# app.include_router(auth.router, prefix="/api/auth", tags=["auth"]) # Todo

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Task Dashboard API"}
