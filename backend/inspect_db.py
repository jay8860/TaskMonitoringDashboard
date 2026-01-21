from database import SessionLocal
import models

db = SessionLocal()
tasks = db.query(models.Task).limit(5).all()

print(f"{'Task No':<20} | {'Description (Notes)':<50} | {'Assigned':<20}")
print("-" * 100)
for t in tasks:
    desc = t.description.replace('\n', ' ')[:47] + '...' if len(t.description) > 50 else t.description
    print(f"{t.task_number:<20} | {desc:<50} | {t.assigned_agency:<20}")
