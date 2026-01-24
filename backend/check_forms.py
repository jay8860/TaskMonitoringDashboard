from oauth2client.service_account import ServiceAccountCredentials
import os
import json

# Try importing googleapiclient
try:
    from googleapiclient.discovery import build
    print("SUCCESS: googleapiclient imported.")
except ImportError:
    print("ERROR: googleapiclient not found.")
    exit(1)

FORM_ID = "11KlagnjpMfnGYC3Ygy3vK5rDgoSPpUPz0Gr8B83aGj8"
SCOPES = ["https://www.googleapis.com/auth/forms.body", "https://www.googleapis.com/auth/drive"]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.path.join(BASE_DIR, "../credentials.json")

if not os.path.exists(CREDENTIALS_FILE):
     CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials.json")

def check_form_access():
    print(f"Using credentials at: {CREDENTIALS_FILE}")
    creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, SCOPES)
    
    # We need to convert oauth2client creds to google-auth creds usually for discovery.build??
    # Actually build() accepts `credentials=`. Let's see if it accepts oauth2client creds (older lib)
    # or if we need to upgrade logic. 
    # Usually people use `google.oauth2.service_account`.
    # Let's try pure simple build first.
    
    try:
        service = build('forms', 'v1', credentials=creds)
        print("Service built.")
        
        res = service.forms().get(formId=FORM_ID).execute()
        print(f"Form Title: {res.get('info', {}).get('title')}")
        
        for item in res.get('items', []):
            print(f"Item ID: {item.get('itemId')} - Title: {item.get('title')}")
            
    except Exception as e:
        print(f"API Error: {e}")
        # If it fails due to auth lib mismatch (oauth2client vs google-auth), we might need to adjust.

if __name__ == "__main__":
    check_form_access()
