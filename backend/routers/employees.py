from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

# --- Schema ---
class EmployeeBase(BaseModel):
    name: str # The casual name, e.g. "Aditya"
    mobile: Optional[str] = None
    display_name: str # The official Sheet name, e.g. "Aditya DMF"

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    display_name: Optional[str] = None

class EmployeeOut(EmployeeBase):
    id: int
    
    class Config:
        from_attributes = True

# --- Routes ---

@router.get("/", response_model=List[EmployeeOut])
def get_employees(db: Session = Depends(get_db)):
    return db.query(models.Employee).all()

@router.post("/", response_model=EmployeeOut)
def create_employee(employee: EmployeeCreate, db: Session = Depends(get_db)):
    # Check duplicate display_name
    existing = db.query(models.Employee).filter(models.Employee.display_name == employee.display_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Employee with this Display Name already exists.")
    
    db_emp = models.Employee(**employee.dict())
    db.add(db_emp)
    db.commit()
    db.refresh(db_emp)
    return db_emp

@router.put("/{emp_id}", response_model=EmployeeOut)
def update_employee(emp_id: int, update: EmployeeUpdate, db: Session = Depends(get_db)):
    emp = db.query(models.Employee).filter(models.Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check duplicate if changing display_name
    if update.display_name and update.display_name != emp.display_name:
        existing = db.query(models.Employee).filter(models.Employee.display_name == update.display_name).first()
        if existing:
             raise HTTPException(status_code=400, detail="Display Name already taken.")

    data = update.dict(exclude_unset=True)
    for key, value in data.items():
        setattr(emp, key, value)
    
    db.commit()
    db.refresh(emp)
    return emp

    db.delete(emp)
    db.commit()
    return {"message": "Deleted"}

@router.post("/sync-dropdowns")
def sync_dropdowns():
    print("Triggering Manual Dropdown Sync...")
    try:
        # Import dynamically to avoid circular deps or path issues if any, but regular import should work
        # assuming running from backend root
        import sync_all_dropdowns
        sync_all_dropdowns.sync_all_dropdowns()
        return {"message": "Synced Google Sheet & Form Dropdowns"}
    except Exception as e:
        print(f"Sync Error: {e}")
        # Build specific error message
        raise HTTPException(status_code=500, detail=f"Sync Failed: {str(e)}")
