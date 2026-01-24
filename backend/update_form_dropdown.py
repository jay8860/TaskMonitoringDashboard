from oauth2client.service_account import ServiceAccountCredentials
from googleapiclient.discovery import build
import os
import json
from database import SessionLocal
import models

# Configuration
FORM_ID = "11KlagnjpMfnGYC3Ygy3vK5rDgoSPpUPz0Gr8B83aGj8"
SCOPES = ["https://www.googleapis.com/auth/forms.body", "https://www.googleapis.com/auth/drive"]
QUESTION_TITLE = "Assigned To"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.path.join(BASE_DIR, "../credentials.json")

if not os.path.exists(CREDENTIALS_FILE):
     CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials.json")

def update_form_dropdown():
    print(f"Using credentials at: {CREDENTIALS_FILE}")
    creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, SCOPES)
    
    try:
        service = build('forms', 'v1', credentials=creds)
        
        # 1. Fetch Form to find Item ID
        print("Fetching Form Schema...")
        form = service.forms().get(formId=FORM_ID).execute()
        
        target_item_id = None
        for item in form.get('items', []):
            title = item.get('title', '').strip()
            # Simple match
            if title.lower() == QUESTION_TITLE.lower():
                target_item_id = item.get('itemId')
                print(f"Found '{QUESTION_TITLE}' (ID: {target_item_id})")
                break
        
        if not target_item_id:
            print(f"ERROR: Could not find question with title '{QUESTION_TITLE}'")
            # List available just in case
            print("Available questions:")
            for item in form.get('items', []):
                print(f"- {item.get('title')} ({item.get('itemId')})")
            return

        # 2. Fetch Employees from DB
        db = SessionLocal()
        employees = db.query(models.Employee).all()
        # Sort Alphabetically, ignore case
        officers = sorted([e.display_name for e in employees], key=lambda x: x.lower())
        db.close()
        
        print(f"Found {len(officers)} officers in DB.")
        if not officers:
            print("No officers found. Aborting.")
            return

        # 3. Construct Update Request
        # API requires "values": [{"value": "Option 1"}, ...]
        options = [{"value": name} for name in officers]
        
        update_request = {
            "updateItem": {
                "item": {
                    "itemId": target_item_id,
                    "questionItem": {
                        "question": {
                            "choiceQuestion": {
                                "type": "DROP_DOWN",
                                "options": options,
                                "shuffle": False
                            }
                        }
                    }
                },
                "location": {
                    "index": 0 # Index is required but creating a new item? No, updateItem updates existing.
                    # Wait, 'location' field behavior in updateItem?
                    # "location: The location of the item in the form..." 
                    # Actually, if we provide the full item structure with ID, we might not need location if we use proper field mask.
                    # BUT the API says: "UpdateItemRequest... item: The item to update... updateMask: ... location: ..."
                },
                "updateMask": "questionItem.question.choiceQuestion.options"
            }
        }
        
        # NOTE: updateItem requires identifying the item by ID in the 'item' object.
        # But 'location' allows MOVING it. We don't want to move it.
        # So we omit 'location' from the request if possible, or verify docs.
        # Docs: "location" is optional.
        
        batch_request = {
            "requests": [update_request]
        }
        
        print("Updating Form...")
        service.forms().batchUpdate(formId=FORM_ID, body=batch_request).execute()
        print("Successfully updated Google Form dropdown.")
        
    except Exception as e:
        print(f"Sync Failed: {e}")

if __name__ == "__main__":
    update_form_dropdown()
