import pandas as pd
import requests
import io
from sqlalchemy.orm import Session
import models
from datetime import datetime, timedelta
import re

SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSoXCOsOpdPTE8ON_fTs8C2j-q_fUjbG2c3o3mG7BdZyRZxwugYPoz6R_fVRCSl1G4ApAhuCtoK-2lQ/pub?gid=241700266&single=true&output=csv"

def parse_date(val):
    if pd.isna(val) or not str(val).strip():
        return None
    
    formats = [
        "%d/%m/%Y", "%Y-%m-%d", "%b %d, %Y", "%d-%m-%Y", 
        "%d.%m.%y", "%d.%m.%Y" # Handle 13.01.26
    ]
    
    val_str = str(val).strip()
    
    for fmt in formats:
        try:
            return datetime.strptime(val_str, fmt).date()
        except ValueError:
            continue
    return None

# --- Configuration ---
SHEET_ID = "1qpGrwi8K8m-HYuKwlieClTDHSYVucbQW33AIpkIWqxM"
TAB_NAME = "To Do (After 01/01/2026)"

# --- Two-Way Sync Logic ---
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.path.join(BASE_DIR, "../credentials.json") # Search in root or backend
if not os.path.exists(CREDENTIALS_FILE):
     CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials.json")

SCOPE = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']

def get_gspread_client():
    print(f"DEBUG: Attempting to authenticate with Google Sheets...")
    # 1. Try Environment Variable (Best for Production/Hosting)
    json_creds = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if json_creds:
        try:
            creds_dict = json.loads(json_creds)
            creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, SCOPE)
            client = gspread.authorize(creds)
            print("DEBUG: Authenticated via GOOGLE_CREDENTIALS_JSON env var.")
            return client
        except Exception as e:
            print(f"Error authenticating from Env Var: {e}")

    # 2. Try Local File (Best for Localhost)
    print(f"DEBUG: Looking for credentials at: {CREDENTIALS_FILE}")
    if not os.path.exists(CREDENTIALS_FILE):
        print(f"ERROR: Credentials file not found at {CREDENTIALS_FILE}")
        return None
    try:
        creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, SCOPE)
        client = gspread.authorize(creds)
        print("DEBUG: Authenticated via local credentials.json file.")
        return client
    except Exception as e:
        print(f"Error authenticating with Google Sheets: {e}")
        return None

def fetch_data_from_api():
    """Fetches data directly from Google Sheets API to avoid CSV publishing delay."""
    client = get_gspread_client()
    if not client:
        print("DEBUG: API Client is None, skipping API fetch.")
        return None # Fallback to CSV
    
    try:
        sheet = client.open_by_key(SHEET_ID).worksheet(TAB_NAME)
        # Get all values
        data = sheet.get_all_values()
        if not data:
            print("DEBUG: Sheet returned no data.")
            return None
            
        # Convert to DataFrame
        headers = data[0]
        rows = data[1:]
        df = pd.DataFrame(rows, columns=headers)
        print(f"DEBUG: Successfully fetched {len(df)} rows from API.")
        return df
    except Exception as e:
        print(f"API Fetch Failed: {e}")
        return None

def sync_data(db: Session):
    print("Syncing Data...")
    
    # Try API first (Real-time), Fallback to CSV (Cached/Published)
    df = fetch_data_from_api()
    
    if df is None:
        print("Falling back to CSV download...")
        try:
            response = requests.get(SHEET_URL, timeout=10)
            response.raise_for_status()
            df = pd.read_csv(io.BytesIO(response.content), encoding='utf-8')
            print("DEBUG: Successfully fetched data from CSV.")
        except Exception as e:
            print(f"ERROR: Both API and CSV sync failed: {e}")
            return {"error": f"Both API and CSV sync failed: {e}"}

    try:
        # Global Clean: Replace NaN with empty string
        df = df.fillna('')
        
        # Cleanup Column Names (strip spaces)
        df.columns = df.columns.astype(str).str.strip()
        print(f"DEBUG: Found Sheet Columns: {df.columns.tolist()}")
        if not df.empty:
            print(f"DEBUG: First Row: {df.iloc[0].to_dict()}")
            
        # Helper for cleaning strings
        def clean_str(val):
            s = str(val).strip()
            if s.lower() == 'nan': return ''
            return s

        # Cleanup duplicate Task/File Nos - Keep last entry (or first)
        # Note: We need to clean the column first
        df['Task/File No'] = df['Task/File No'].astype(str).str.strip().str.lstrip('#')
        df = df.drop_duplicates(subset=['Task/File No'], keep='last')
        
        count_inserted = 0
        count_updated = 0
        count_deleted = 0
        sheet_task_ids = set()
        
        print(f"Processing {len(df)} rows...")
        
        for idx, row in df.iterrows():
            raw_task_no = str(row.get('Task/File No', '')).strip()
            # Clean Task No: remove leading hash and spaces
            task_no = raw_task_no.lstrip('#').strip()
            
            if not task_no or task_no.lower() == 'nan':
                continue
                
            # Check existing
            existing = db.query(models.Task).filter(models.Task.task_number == task_no).first()
            
            # Parse Dates
            alloc_date = parse_date(row.get('Task Allocated Date'))
            dead_date = parse_date(row.get('Deadline for Completion'))
            
            # Failsafe: Calculate Deadline if missing in Sheet (e.g. formula not extended)
            if not dead_date and alloc_date:
                time_given_str = str(row.get('Time given for task (by default 7 days)', '')).strip()
                # Extract number (e.g. "7 days" -> 7)
                match = re.search(r'(\d+)', time_given_str)
                if match:
                    try:
                        days = int(match.group(1))
                        dead_date = alloc_date + timedelta(days=days)
                        print(f"DEBUG: Calculated missing deadline for {task_no}: {dead_date}")
                    except:
                        pass
            
            # Logic for Status
            comp_val = str(row.get('Task Completion Date', '')).strip().lower()
            deadline_due_val = str(row.get('Deadline due in', '')).strip().lower()
            
            status = "Pending"
            comp_date = None
            
            if comp_val and comp_val not in ['nan', '', '0']:
                status = "Completed"
                parsed_comp = clean_str(comp_val)
                if parsed_comp:
                    comp_date = parsed_comp
                    status = "Completed"
            elif dead_date and dead_date < datetime.now().date():
                status = "Overdue"
            
            if deadline_due_val == 'completed':
                status = "Completed"

            data = {
                "task_number": task_no,
                "description": clean_str(row.get('Notes/Comments by Steno', '')),
                "assigned_agency": clean_str(row.get('Assigned To', '')),
                "priority": clean_str(row.get('Priority', '')),
                "allocated_date": alloc_date,
                "deadline_date": dead_date,
                "completion_date": comp_date,
                "status": status,
                "deadline_due_in": row.get('Deadline due in', ''), # Raw value
                "time_given": row.get('Time given for task (by default 7 days)', ''), # Raw value
                "source": "Sheet"
            }
            
            if existing:
                existing.description = data['description']
                existing.assigned_agency = data['assigned_agency']
                existing.priority = data['priority']
                existing.allocated_date = data['allocated_date']
                existing.deadline_date = data['deadline_date']
                existing.status = data['status']
                existing.deadline_due_in = data['deadline_due_in']
                existing.time_given = data['time_given']
                if data['completion_date']:
                    existing.completion_date = data['completion_date']
                count_updated += 1
            else:
                new_task = models.Task(**data)
                db.add(new_task)
                count_inserted += 1
            
            # Track valid task numbers from Sheet
            sheet_task_ids.add(task_no)
        
        # --- Deletion Logic ---
        # Delete tasks from DB that are NOT in the Sheet
        # (The Sheet is the source of truth for existence)
        if sheet_task_ids:
            tasks_to_delete = db.query(models.Task).filter(models.Task.task_number.notin_(sheet_task_ids)).all()
            count_deleted = len(tasks_to_delete)
            for t in tasks_to_delete:
                db.delete(t)
        else:
             # If sheet is empty logic (optional, safe to skip or delete all?)
             # For safety, let's assume we don't wipe DB if sheet parse fails completely, 
             # but here we are inside a successful df iteration.
             # If df was empty, we wouldn't be here (checked at top).
             pass

        db.commit()
        return {"inserted": count_inserted, "updated": count_updated, "deleted": count_deleted}
        
    except Exception as e:
        print(f"Sync Processing Failed: {e}")
        return {"error": str(e)}

def update_sheet_task(task_number: str, updates: dict):
    """
    Updates the Google Sheet row corresponding to the task_number.
    Mapping (1-based index):
    1. S No
    2. Deadline due in
    3. Task Completion Date
    4. Task/File No
    5. Notes/Comments by Steno
    6. Assigned To
    7. Priority
    8. Task Allocated Date
    9. Time given for task
    10. Deadline for Completion
    """
    client = get_gspread_client()
    if not client:
        return {"status": "skipped", "reason": "No credentials"}

    try:
        sheet = client.open_by_key(SHEET_ID).worksheet(TAB_NAME)
        
        # Find cell with task number
        # Strategy Update: sheet.find() is unreliable for special chars/formatting.
        # We fetch all Task Numbers (Col 4) and find the row index manually.
        row_idx = None
        try:
            task_col_values = sheet.col_values(4) # Get all values in Column D
            
            # Search for exact match (stripping whitespace)
            clean_task_number = str(task_number).strip()
            
            for index, value in enumerate(task_col_values):
                if str(value).strip() == clean_task_number:
                    row_idx = index + 1 # 1-based index for GSpread
                    break
        except Exception as e:
            print(f"Error searching for task in column: {e}")

        if not row_idx:
            print(f"Task '{task_number}' not found in Sheet. Appending new row...")
            
            # --- Append New Row Logic ---
            # Strategy: Find the first empty row based on Column 4 (Task/File No)
            # and write ONLY to Columns 4, 5, 6, 7, 8, 9. 
            # We skip Col 1, 2, 3 and 10 as per user request (formulas).
            
            try:
                # Re-fetch or use existing list length
                col_4_len = len(sheet.col_values(4))
                next_row = col_4_len + 1
            except Exception as e:
                # Fallback if empty sheet
                next_row = 2 
            
            # Data to write to D{next_row}:I{next_row}
            # Col 4 (D): Task/File No
            # Col 5 (E): Notes/Comments
            # Col 6 (F): Assigned To
            # Col 7 (G): Priority
            # Col 8 (H): Allocated Date
            # Col 9 (I): Time Given
            
            def format_date_for_sheet(date_val):
                if not date_val: return ""
                try:
                    # Try parsing YYYY-MM-DD
                    d = datetime.strptime(str(date_val), '%Y-%m-%d')
                    return d.strftime('%b %d, %Y') # Jun 13, 2025
                except:
                    return str(date_val)

            row_data = [[
                task_number,                             
                updates.get('description', ''),          
                updates.get('assigned_agency', ''),      
                updates.get('priority', ''),             
                format_date_for_sheet(updates.get('allocated_date', datetime.now().strftime('%Y-%m-%d'))), 
                updates.get('time_given', '')                                
            ]]
            
            # User request: Do NOT write to Col 10 (Deadline). It updates automatically via formula based on Col 8 & 9.
            range_name = f"D{next_row}:I{next_row}"

            sheet.update(range_name, row_data, value_input_option='USER_ENTERED')
            
            print(f"Successfully appended new Task {task_number} to Sheet at row {next_row}")
            return {"status": "success"}
        
        # --- Update Existing Row Logic ---
        
        if 'description' in updates:
            sheet.update_cell(row_idx, 5, updates['description']) 
            
        if 'assigned_agency' in updates:
             sheet.update_cell(row_idx, 6, updates['assigned_agency']) 
             
        if 'priority' in updates:
            sheet.update_cell(row_idx, 7, updates['priority']) 

        if 'allocated_date' in updates:
             # Format date before sending
             val = updates['allocated_date']
             try:
                 d = datetime.strptime(str(val), '%Y-%m-%d')
                 val = d.strftime('%b %d, %Y')
             except:
                 pass
             sheet.update_cell(row_idx, 8, val)

        if 'time_given' in updates:
             sheet.update_cell(row_idx, 9, updates['time_given']) 

        # Col 10 (Deadline) skipped as per user request (Auto-update formula)
            
        if 'completion_date' in updates:
             val_to_send = updates['completion_date'] if updates['completion_date'] is not None else ""
             print(f"SYNCING COMPLETION_DATE to Sheet for Row {row_idx}: '{val_to_send}'")
             sheet.update_cell(row_idx, 3, str(val_to_send))
            
        print(f"Successfully updated Sheet for Task {task_number}")
        return {"status": "success"}

    except Exception as e:
        print(f"Sheet Update Failed: {e}")
        return {"error": str(e)}

def delete_sheet_task(task_number: str):
    """
    Deletes the Google Sheet row corresponding to the task_number.
    """
    client = get_gspread_client()
    if not client:
        return {"status": "skipped", "reason": "No credentials"}

    try:
        sheet = client.open_by_key(SHEET_ID).worksheet(TAB_NAME)
        
        # Find cell with task number
        cell = None
        try:
            cell = sheet.find(task_number)
        except:
            pass
            
        if not cell:
             try:
                cell = sheet.find(f"#{task_number}")
             except:
                pass
             
        if not cell:
            print(f"Task {task_number} not found in sheet to delete.")
            return {"status": "not_found"}
            
        # Delete row
        sheet.delete_rows(cell.row)
        print(f"Successfully deleted Task {task_number} from Sheet")
        return {"status": "success"}

    except Exception as e:
        print(f"Sheet Delete Failed: {e}")
        return {"error": str(e)}

def push_portal_to_sheet(db: Session):
    """
    One-Way Sync: Pushes ALL data from Portal DB to Google Sheet.
    - Matches tasks by Task Number.
    - Updates existing rows.
    - Appends new rows.
    """
    print("🚀 Starting One-Way Sync (Portal -> Sheet)...")
    client = get_gspread_client()
    if not client:
        return {"error": "Authentication failed"}

    try:
        sheet = client.open_by_key(SHEET_ID).worksheet(TAB_NAME)
        
        # 1. Fetch ALL Tasks from DB
        db_tasks = db.query(models.Task).all()
        print(f"📦 Found {len(db_tasks)} tasks in Portal DB.")

        # 2. Fetch Current Sheet Data (to safely update rows)
        # We need a map of {Task_No: Row_Index}
        try:
            task_col_values = sheet.col_values(4) # Column D is Task No
        except Exception as e:
            print("Error reading sheet column:", e)
            task_col_values = []
            
        sheet_map = {}
        for idx, val in enumerate(task_col_values):
            clean_val = str(val).strip()
            if clean_val and clean_val.lower() != 'nan':
                sheet_map[clean_val] = idx + 1 # 1-based index

        # 3. SMART SYNC: Pull NEW tasks from Sheet first (e.g. Google Forms)
        print("🔄 Checking for new tasks from Sheet...")
        # Get all rows to check for new ones
        all_sheet_rows = sheet.get_all_records()
        
        # We need to map DB tasks by Task Number for quick lookup
        db_task_map = {str(t.task_number).strip(): t for t in db_tasks}
        
        new_tasks_count = 0
        for row in all_sheet_rows:
            # Note: gspread get_all_records uses header keys
            # Keys might vary slightly, so be robust
            row_task_no = str(row.get('Task/File No', row.get('Task/File No', ''))).strip().lstrip('#')
            
            if not row_task_no or row_task_no.lower() == 'nan':
                 continue
                 
            if row_task_no not in db_task_map:
                print(f"🆕 Found new task in Sheet: {row_task_no}. Importing...")
                
                # Parse Helper
                def clean_val(k): return str(row.get(k, '')).strip()
                def parse_sheet_date(v): return parse_date(v)

                new_task_data = {
                    "task_number": row_task_no,
                    "description": clean_val('Notes/Comments by Steno'),
                    "assigned_agency": clean_val('Assigned To'),
                    "priority": clean_val('Priority'),
                    "allocated_date": parse_sheet_date(row.get('Task Allocated Date')),
                    "deadline_date": parse_sheet_date(row.get('Deadline for Completion')),
                    "completion_date": clean_val('Task Completion Date'),
                    "status": "Pending", # Default
                    "deadline_due_in": clean_val('Deadline due in'),
                    "time_given": clean_val('Time given for task'),
                    "source": "Sheet"
                }
                
                # Basic Status Logic
                if new_task_data['completion_date']:
                    new_task_data['status'] = "Completed"
                elif new_task_data['deadline_date'] and new_task_data['deadline_date'] < datetime.now().date():
                     new_task_data['status'] = "Overdue"

                new_db_task = models.Task(**new_task_data)
                db.add(new_db_task)
                new_tasks_count += 1
                
        if new_tasks_count > 0:
            db.commit()
            print(f"✅ Imported {new_tasks_count} new tasks from Sheet.")
            # Refresh DB list to include new ones for the push phase
            db_tasks = db.query(models.Task).all() 

        # 4. PUSH PHASE: Push ALL Portal Data to Sheet
        print("📤 Pushing data to Sheet (Batch Mode)...")
        
        updates_batch = []
        rows_to_append = []
        
        count_updated = 0
        count_appended = 0
        
        for task in db_tasks:
            t_no = str(task.task_number).strip()
            
            # Helper: Format Date
            def fmt_date(d):
                if not d: return ""
                try:
                    return d.strftime('%b %d, %Y')
                except:
                    return str(d)

            # Row Data Structure (Cols D to I)
            # Col 4(D): Task No
            # Col 5(E): Description
            # Col 6(F): Assigned To
            # Col 7(G): Priority
            # Col 8(H): Allocated Date
            # Col 9(I): Time Given
            
            row_values = [
                t_no,
                task.description or "",
                task.assigned_agency or "",
                task.priority or "",
                fmt_date(task.allocated_date),
                task.time_given or ""
            ]
            
            # Completion Date separate logic (Col C)
            # Use None (null) instead of "" to ensure ISBLANK() works in Google Sheet
            comp_val = task.completion_date if task.completion_date else None

            if t_no in sheet_map:
                # UPDATE Existing Row (Prepare Batch Request)
                row_idx = sheet_map[t_no]
                
                # Range D..I
                updates_batch.append({
                    'range': f'D{row_idx}:I{row_idx}',
                    'values': [row_values]
                })
                # Range C (Completion Date)
                updates_batch.append({
                    'range': f'C{row_idx}',
                    'values': [[comp_val]]
                })
                count_updated += 1
            else:
                # APPEND New Row
                full_row = [
                    "", # A: S.No (Formula)
                    "", # B: Due In (Formula)
                    comp_val, # C: Comp Date
                    t_no, # D
                    task.description or "", # E
                    task.assigned_agency or "", # F
                    task.priority or "", # G
                    fmt_date(task.allocated_date), # H
                    task.time_given or "", # I
                    "" # J: Deadline (Formula)
                ]
                rows_to_append.append(full_row)
                count_appended += 1
        
        # EXECUTE BATCH UPDATE (Existing Rows)
        if updates_batch:
            print(f"⚡ Batch Updating {len(updates_batch)} ranges...")
            sheet.batch_update(updates_batch)
        
        # EXECUTE APPEND (New Rows)
        if rows_to_append:
             print(f"➕ Appending {len(rows_to_append)} new rows...")
             sheet.append_rows(rows_to_append, value_input_option='USER_ENTERED')

        print(f"✅ One-Way Sync Complete. Updated: {count_updated}, Appended: {count_appended}")
        return {"status": "success", "updated": count_updated, "appended": count_appended}

    except Exception as e:
        print(f"❌ One-Way Sync Failed: {e}")
        # Print full stack trace for debugging
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


if __name__ == "__main__":
    # Test Run
    from database import SessionLocal
    db = SessionLocal()
    from database import engine, Base
    Base.metadata.create_all(bind=engine)
    # print(sync_data(db)) # Deprecated
    print(push_portal_to_sheet(db))
