from sqlalchemy import Column, Integer, String, Date, Text, Float, DateTime
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="viewer") # admin, viewer
    email = Column(String, unique=True, index=True, nullable=True)
    password_hint = Column(String, nullable=True)
    reset_token = Column(String, nullable=True)
    reset_token_expiry = Column(DateTime, nullable=True)

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_number = Column(String, unique=True, index=True) # "Task/File No"
    
    description = Column(Text, nullable=True) # "Notes/Comments by Steno"
    assigned_agency = Column(String, index=True, nullable=True) # "Assigned To"
    priority = Column(String, nullable=True)
    
    allocated_date = Column(Date, nullable=True) 
    deadline_date = Column(Date, nullable=True) # "Deadline for Completion"
    completion_date = Column(String, nullable=True) # "Task Completion Date" - Changed to String for remarks like "Close"
    
    # New Columns
    deadline_due_in = Column(String, nullable=True) # "Deadline due in"
    time_given = Column(String, nullable=True) # "Time given for task"
    is_pinned = Column(Integer, default=0, index=True) # 0=False, 1=True (Boolean in SQLite)

    status = Column(String, index=True, default="Pending") # Derived or Explicit
    remarks = Column(Text, nullable=True)
    
    source = Column(String, default="Sheet") # Sheet, Manual
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class Employee(Base):
    __tablename__ = "employees"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False) # e.g. "Aditya"
    mobile = Column(String, nullable=True)
    display_name = Column(String, unique=True, index=True, nullable=False) # e.g. "Aditya DMF"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
