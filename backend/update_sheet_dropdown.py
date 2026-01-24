from ingester import get_gspread_client, SHEET_ID, TAB_NAME
from database import SessionLocal
import models

def update_sheet_dropdown(officers_list=None):
    client = get_gspread_client()
    if not client:
        print("Failed to authenticate with Google Sheets.")
        return

    try:
        # Open Sheet
        # TAB_NAME from ingester is "To Do (After 01/01/2026)"
        # Note: We need the actual WORKSHEET ID (gid) for batch_update, not the spreadhseet ID.
        spreadsheet = client.open_by_key(SHEET_ID)
        worksheet = spreadsheet.worksheet(TAB_NAME)
        
        # Determine SheetId (GID)
        sheet_id = worksheet.id
        print(f"Target Sheet ID (GID): {sheet_id}")

        # Fetch Employees
        if officers_list:
            print(f"Using provided list of {len(officers_list)} officers.")
            officers = sorted(officers_list, key=lambda x: x.lower())
        else:
            db = SessionLocal()
            employees = db.query(models.Employee).all()
            # Sort Alphabetically, ignore case
            officers = sorted([e.display_name for e in employees], key=lambda x: x.lower())
            db.close()
        
        print(f"Found {len(officers)} officers.")
        
        if not officers:
            print("No officers found. Aborting.")
            return

        # Constuct Validation Rule
        # Column F is Index 5 (0-based)
        # Apply from Row 2 (Index 1) to Row 5000
        
        range_grid = {
            "sheetId": sheet_id,
            "startRowIndex": 1,
            "endRowIndex": 2000, # Reasonable limit
            "startColumnIndex": 5, # Column F
            "endColumnIndex": 6
        }
        
        # Build Values List
        values = [{"userEnteredValue": name} for name in officers]
        
        request_body = {
            "requests": [
                {
                    "setDataValidation": {
                        "range": range_grid,
                        "rule": {
                            "condition": {
                                "type": "ONE_OF_LIST",
                                "values": values
                            },
                            "showCustomUi": True,
                            "strict": False # Let's keep it lenient initially to avoid breaking existing data. Or True? User said "match it". True is safer for dropdown UI.
                        }
                    }
                }
            ]
        }

        # Execute Batch Update
        spreadsheet.batch_update(request_body)
        print("Successfully updated Dropdown in Google Sheet (Column F).")

    except Exception as e:
        print(f"Error updating sheet: {e}")

if __name__ == "__main__":
    update_sheet_dropdown()
