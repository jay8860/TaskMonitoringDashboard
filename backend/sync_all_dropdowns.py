import logging
import requests
import time
from update_sheet_dropdown import update_sheet_dropdown
from update_form_dropdown import update_form_dropdown

# PRODUCTION URL provided by user
PROD_API_URL = "https://taskmonitoringdashboard-production.up.railway.app/api/employees/"

# Configure Logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

def fetch_prod_employees():
    print(f"Fetching employees from Production: {PROD_API_URL}")
    try:
        response = requests.get(PROD_API_URL, timeout=10)
        if response.status_code == 200:
            data = response.json()
            # Extract display_name
            names = [e.get('display_name', '').strip() for e in data if e.get('display_name')]
            print(f"Successfully fetched {len(names)} employees from Production.")
            return names
        else:
            print(f"Failed to fetch from Prod. Status: {response.status_code}")
    except Exception as e:
        print(f"Error fetching from Prod: {e}")
    return None

def sync_all_dropdowns():
    print("--- STARTING UNIFIED DROPDOWN SYNC ---")
    
    # 1. Fetch Data (Prefer Prod, Fallback to Local is handled inside functions if None passed)
    # But since user specifically wants Prod Sync, we try hard.
    officers_list = fetch_prod_employees()
    
    if not officers_list:
        print("⚠️ WARNING: Could not fetch from Production. Falling back to LOCAL Database.")
        # If we return None, the update functions will use local DB.
    
    # 2. Sync Sheet
    print("\n[1/2] Syncing Google Sheet Dropdown...")
    try:
        update_sheet_dropdown(officers_list)
        print("✅ Google Sheet Sync Completed.")
    except Exception as e:
        print(f"❌ Google Sheet Sync Failed: {e}")

    # Small delay
    time.sleep(1)

    # 3. Sync Form
    print("\n[2/2] Syncing Google Form Dropdown...")
    try:
        update_form_dropdown(officers_list)
        print("✅ Google Form Sync Completed.")
    except Exception as e:
        print(f"❌ Google Form Sync Failed: {e}")
        
    print("\n--- SYNC PROCESS FINISHED ---")

if __name__ == "__main__":
    sync_all_dropdowns()
