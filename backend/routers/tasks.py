from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import ingester
import google.generativeai as genai
import os
import json

router = APIRouter()

# --- Schemas ---
class TaskCreate(BaseModel):
    task_number: Optional[str] = None
    description: Optional[str] = None
    assigned_agency: Optional[str] = None
    priority: Optional[str] = None
    allocated_date: Optional[date] = None
    deadline_date: Optional[date] = None
    status: Optional[str] = "Pending"
    remarks: Optional[str] = None
    deadline_due_in: Optional[str] = None
    time_given: Optional[str] = None
    is_pinned: Optional[bool] = False
    scheduled_date: Optional[date] = None
    attachment_data: Optional[str] = None

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
    is_pinned: Optional[bool] = None
    scheduled_date: Optional[date] = None
    priority: Optional[str] = None

class TaskBulkUpdateItem(BaseModel):
    id: int
    task_number: Optional[str] = None
    description: Optional[str] = None
    assigned_agency: Optional[str] = None
    priority: Optional[str] = None
    allocated_date: Optional[date] = None
    deadline_date: Optional[date] = None
    status: Optional[str] = None
    remarks: Optional[str] = None
    deadline_due_in: Optional[str] = None
    time_given: Optional[str] = None
    is_pinned: Optional[bool] = None
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    completion_date: Optional[str] = None

class TaskBulkUpdateList(BaseModel):
    updates: List[TaskBulkUpdateItem]

# --- Routes ---

@router.post("/sync")
def trigger_sync(db: Session = Depends(get_db)):
    print("--- SYNC ENDPOINT HIT ---")
    try:
        # result = ingester.sync_data(db) # Deprecated
        result = ingester.push_portal_to_sheet(db)
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
def create_task(task: TaskCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Auto-generate Task Number if missing
    if not task.task_number:
        existing_tasks = db.query(models.Task.task_number).all()
        max_num = 0
        for t in existing_tasks:
            t_num = t.task_number
            if t_num and t_num.startswith("Task "):
                try:
                    num = int(t_num.replace("Task ", ""))
                    if num > max_num:
                        max_num = num
                except:
                    pass
        task.task_number = f"Task {max_num + 1}"

    db_task = models.Task(**task.dict(), source="Manual")
    try:
        db.add(db_task)
        db.commit()
        db.refresh(db_task)
        
        # Trigger Two-Way Sync in Background (Fast UI Response)
        background_tasks.add_task(ingester.update_sheet_task, db_task.task_number, task.dict(exclude_unset=True))
        
        return db_task
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error creating task: {str(e)}")

@router.put("/{task_id}")
def update_task(task_id: int, update: TaskUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Not Found")
    
    # Capture original task number
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
    
    # Trigger Two-Way Sync in Background
    print(f"DEBUG: Scheduling sync for update task {original_task_number}...")
    background_tasks.add_task(ingester.update_sheet_task, original_task_number, update_data)
    
    return task

@router.put("/bulk/update")
def bulk_update_tasks(bulk_data: TaskBulkUpdateList, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    updated_count = 0
    
    for update_item in bulk_data.updates:
        task = db.query(models.Task).filter(models.Task.id == update_item.id).first()
        if not task:
            continue
            
        original_task_number = task.task_number
        update_data_dict = update_item.dict(exclude_unset=True)
        update_data_dict.pop('id', None) # Remove ID from update data
        
        if not update_data_dict:
            continue

        for key, value in update_data_dict.items():
            setattr(task, key, value)
            
        # Auto-update status logic (Same as single update)
        if "completion_date" in update_data_dict:
            c_date = update_data_dict["completion_date"]
            if c_date and str(c_date).strip():
                task.status = "Completed"
            else:
                 if task.deadline_date and task.deadline_date < date.today():
                    task.status = "Overdue"
                 else:
                    task.status = "Pending"

        # Trigger Sync
        background_tasks.add_task(ingester.update_sheet_task, original_task_number, update_data_dict)
        updated_count += 1
    
    db.commit()
    return {"message": f"Successfully updated {updated_count} tasks"}

@router.delete("/{task_id}")
def delete_task(task_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Not Found")
    
    task_number = task.task_number
    
    # Delete from DB
    db.delete(task)
    db.commit()
    
    # Trigger Two-Way Sync Delete in Background
    background_tasks.add_task(ingester.delete_sheet_task, task_number)
    
    return {"message": "Task Deleted"}
@router.get("/executive-summary")
def get_executive_summary(db: Session = Depends(get_db)):
    """
    Uses Gemini to generate a pointwise summary of all active (Pending/Overdue) tasks.
    Focuses on highlights and intervention needs.
    """
    # 1. Fetch Active Tasks
    active_tasks = db.query(models.Task).filter(models.Task.status.in_(["Pending", "Overdue"])).all()
    
    if not active_tasks:
        return {"summary": "No active tasks found."}

    # 2. Prepare Data for Gemini (Limit description length to avoid token overflow)
    simplified_tasks = []
    for t in active_tasks:
        simplified_tasks.append({
            "task": t.task_number,
            "assigned": t.assigned_agency or "Unassigned",
            "notes": (t.description[:300] + "...") if t.description and len(t.description) > 300 else t.description,
            "status": t.status,
            "deadline": str(t.deadline_date) if t.deadline_date else "No Deadline"
        })

    # 3. Configure Gemini
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key missing in backend environment.")
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.0-flash')

    prompt = f"""
    You are an Executive Assistant. Here is a list of active tasks from the Dashboard.
    
    TASK LIST:
    {json.dumps(simplified_tasks)}

    INSTRUCTION:
    Create a POINT-WISE Executive Summary for high-level review.
    - Use the EXACT section headers: ### PROGRESS ###, ### INTERVENTION NEEDED ###, and ### OFFICER HIGHLIGHTS ###.
    - DO NOT use excessive bolding (**). Only bold the Task Names.
    - For any task that is "Overdue", append the tag [OVERDUE] in the text.
    - Format:
      * Task Name: Summary of progress or bottleneck. [Status Tag if Overdue]
    
    SECTIONS:
    ### PROGRESS ###: Mention tasks where there are notes indicating progress.
    ### INTERVENTION NEEDED ###: Highlight tasks that are stuck or [OVERDUE].
    ### OFFICER HIGHLIGHTS ###: Briefly mention workload highlights.
    
    Keep it clean, professional, and concise. Use a simple bulleted list.
    """

    try:
        response = model.generate_content(prompt)
        return {"summary": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini Summary Error: {str(e)}")
