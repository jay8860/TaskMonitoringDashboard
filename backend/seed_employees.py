from database import SessionLocal
import models

OFFICERS = [
    "AC Tribal", "Aditya DMF", "Alka DMF", "All CEOs", "All CEOs + LDM", "Amit Skill",
    "APO Tarun", "APO NREGA", "BC PMAY Geedam", "CEO JP Dantewada", "CEO JP Geedam",
    "CEO JP Katekalyan", "CEO JP Kuakonda", "CMHO", "CMO Dantewada", "CS Abhay", "CSEB",
    "CSSDA", "DC PMAY", "DC SBM Mamta", "DD Agri", "DD Vet", "DD Fisheries", "DD Social Welfare",
    "DDP", "DDP + CEO JP Dante", "DEO", "Divya PPIA", "DMC", "DPM Livelihood", "DPM MIS",
    "DPM NRLM", "DPM SMIB", "DPO WCD", "EDM", "EE PWD", "EE RES", "EE RES and Vineet Te",
    "Korram Steno", "LDM and EDM", "Me", "Others", "PO Manoj", "PMGSY", "Pradeep Sports",
    "Praneeth", "Principal Livelihood", "PWD EnM", "PWD SDO Ram", "Sachivs", "SDM Geedam",
    "SDMs", "Sudama", "APO Niramn"
]

def seed_employees():
    db = SessionLocal()
    try:
        count = 0
        for name in OFFICERS:
            # check if exists
            exists = db.query(models.Employee).filter(models.Employee.display_name == name).first()
            if not exists:
                # User requested Name to be same as Display Name for now
                emp = models.Employee(name=name, display_name=name)
                db.add(emp)
                count += 1
        
        db.commit()
        print(f"Seeded {count} employees.")
    except Exception as e:
        print(f"Error seeding: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_employees()
