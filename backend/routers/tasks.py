from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import ingester

router = APIRouter()

# --- Schemas ---
class TaskCreate(BaseModel):
    task_number: str
    description: Optional[str] = None
    assigned_agency: Optional[str] = None
    priority: Optional[str] = None
    allocated_date: Optional[date] = None
    deadline_date: Optional[date] = None
    status: Optional[str] = "Pending"
    remarks: Optional[str] = None
    deadline_due_in: Optional[str] = None
    time_given: Optional[str] = None

class TaskUpdate(BaseModel):
    task_number: Optional[str] = None
    description: Optional[str] = None
    assigned_agency: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None
    completion_date: Optional[str] = None
    deadline_due_in: Optional[str] = None
    time_given: Optional[str] = None
    deadline_date: Optional[date] = None

# --- Routes ---

@router.post("/sync")
def trigger_sync(db: Session = Depends(get_db)):
    print("--- SYNC ENDPOINT HIT ---")
    try:
        result = ingester.sync_data(db)
        print(f"--- SYNC RESULT: {result} ---")
        if "error" in result:
             raise HTTPException(status_code=500, detail=result["error"])
        return result
    except Exception as e:
        print(f"--- SYNC ERROR: {e} ---")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
def get_tasks(
    agency: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = "deadline_date",
    db: Session = Depends(get_db)
):
    query = db.query(models.Task)
    
    if agency:
        if ',' in agency:
            agency_list = [a.strip() for a in agency.split(',')]
            query = query.filter(models.Task.assigned_agency.in_(agency_list))
        else:
            query = query.filter(models.Task.assigned_agency == agency)
            
    if status:
        if ',' in status:
            status_list = [s.strip() for s in status.split(',')]
            query = query.filter(models.Task.status.in_(status_list))
        else:
            query = query.filter(models.Task.status == status)
    if search:
        query = query.filter(models.Task.description.contains(search) | models.Task.task_number.contains(search))
        
    # Sort
    if sort_by == "deadline_date":
        query = query.order_by(models.Task.deadline_date.asc())
    
    return query.all()

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(models.Task).count()
    completed = db.query(models.Task).filter(models.Task.status == "Completed").count()
    overdue = db.query(models.Task).filter(models.Task.status == "Overdue").count()
    pending = total - completed
    
    # Agency Breakdown
    from sqlalchemy import func
    agency_stats = db.query(models.Task.assigned_agency, func.count(models.Task.id))\
        .group_by(models.Task.assigned_agency).all()
        
    return {
        "total": total,
        "completed": completed,
        "overdue": overdue,
        "pending": pending,
        "by_agency": [{"name": a, "count": c} for a, c in agency_stats if a]
    }

@router.post("/")
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    db_task = models.Task(**task.dict(), source="Manual")
    try:
        db.add(db_task)
        db.commit()
        db.refresh(db_task)
        
        # Trigger Two-Way Sync (Fire and Forget or Log Error)
        sync_result = ingester.update_sheet_task(db_task.task_number, task.dict(exclude_unset=True))
        print(f"DEBUG: Sync Result on Create: {sync_result}")
        
        return db_task
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error creating task: {str(e)}")

@router.put("/{task_id}")
def update_task(task_id: int, update: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Not Found")
    
    # Capture original task number to find the row in Sheet
    original_task_number = task.task_number

    update_data = update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
    
    # Auto-update status based on completion_date
    if "completion_date" in update_data:
        c_date = update_data["completion_date"]
        if c_date and str(c_date).strip():
            task.status = "Completed"
        else:
            # Reverting from Completed. Check if Overdue or Pending.
            if task.deadline_date and task.deadline_date < date.today():
                task.status = "Overdue"
            else:
                task.status = "Pending"
                
    db.commit()
    
    # Trigger Two-Way Sync using Original Number
    print(f"DEBUG: Triggering sync for update task {original_task_number}...")
    sync_result = ingester.update_sheet_task(original_task_number, update_data)
    print(f"DEBUG: Sync Result on Update: {sync_result}")
    
    return task

@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Not Found")
    
    task_number = task.task_number
    
    # Delete from DB
    db.delete(task)
    db.commit()
    
    # Trigger Two-Way Sync Delete
    ingester.delete_sheet_task(task_number)
    
    return {"message": "Task Deleted"}
