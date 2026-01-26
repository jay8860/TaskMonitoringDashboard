from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from ics import Calendar, Event
from datetime import datetime, timedelta

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/feed", tags=["calendar"])
def get_calendar_feed(db: Session = Depends(get_db)):
    """
    Generates an ICS calendar feed of all tasks with a deadline or scheduled date.
    """
    try:
        tasks = db.query(models.Task).filter((models.Task.deadline_date != None) | (models.Task.scheduled_date != None)).all()
        
        c = Calendar()
        
        for task in tasks:
            e = Event()
            e.name = f"#{task.task_number} {task.assigned_agency or ''}"
            
            # Use scheduled date if available, else deadline
            date_only = task.scheduled_date or task.deadline_date
            
            if date_only:
                if task.scheduled_date and task.scheduled_time:
                    # Specific Time
                    try:
                        # Combine Date + Time
                        dt_str = f"{task.scheduled_date.strftime('%Y-%m-%d')} {task.scheduled_time}"
                        # Parse
                        e.begin = dt_str # ics library handles ISO-like strings often, or use datetime object
                        # Let's use arrow or datetime to be safe
                        # e.begin = datetime.strptime(dt_str, '%Y-%m-%d %H:%M')
                        # The ics library is smart.
                    except:
                        e.begin = date_only.strftime('%Y-%m-%d')
                        e.make_all_day()
                else:
                    # All day event
                    e.begin = date_only.strftime('%Y-%m-%d')
                    e.make_all_day()
            
            description_lines = []
            if task.description:
                description_lines.append(f"Description: {task.description}")
            if task.priority:
                description_lines.append(f"Priority: {task.priority}")
            if task.status:
                description_lines.append(f"Status: {task.status}")
                
            e.description = "\n".join(description_lines)
            
            # Add URL if needed (e.g. deep link to task dashboard)
            # e.url = f"http://localhost:5173/task/{task.id}" 
            
            c.events.add(e)
            
        return Response(content=str(c), media_type="text/calendar")
        
    except Exception as e:
        print(f"Calendar Feed Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
