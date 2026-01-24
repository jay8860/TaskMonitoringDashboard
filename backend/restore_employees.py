import requests
import json
import logging
import time

# Configuration
PROD_API_URL = "https://taskmonitoringdashboard-production.up.railway.app/api/employees/"
BACKUP_FILE = "employee_backup.json"

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def restore_employees():
    logging.info(f"Starting Restoration from {BACKUP_FILE}...")
    
    # 1. Load Backup
    try:
        with open(BACKUP_FILE, 'r') as f:
            backup_data = json.load(f)
        logging.info(f"Loaded {len(backup_data)} employees from backup.")
    except FileNotFoundError:
        logging.error("❌ Backup file not found!")
        return
    except Exception as e:
        logging.error(f"❌ Error reading backup: {e}")
        return

    # 2. Fetch Current Data
    try:
        response = requests.get(PROD_API_URL, timeout=10)
        if response.status_code != 200:
            logging.error(f"❌ Failed to fetch current data. Status: {response.status_code}")
            return
        current_data = response.json()
        
        # Create map of current Display Names for quick lookup
        current_map = {e.get('display_name'): e for e in current_data}
        logging.info(f"Current Portal has {len(current_data)} employees.")
        
    except Exception as e:
        logging.error(f"❌ Error fetching current data: {e}")
        return

    # 3. Restore Missing
    restored_count = 0
    skipped_count = 0
    
    for emp in backup_data:
        display_name = emp.get('display_name')
        
        if display_name in current_map:
            skipped_count += 1
            continue
            
        logging.info(f"Restoring missing employee: {display_name}...")
        
        # Prepare payload (exclude ID to let DB auto-increment)
        payload = {
            "name": emp.get('name'),
            "mobile": emp.get('mobile'),
            "display_name": display_name
        }
        
        try:
            res = requests.post(PROD_API_URL, json=payload, timeout=10)
            if res.status_code == 200:
                logging.info(f"✅ Restored: {display_name}")
                restored_count += 1
                time.sleep(0.2) # Rate limit politeness
            else:
                logging.error(f"❌ Failed to restore {display_name}: {res.text}")
        except Exception as e:
            logging.error(f"❌ Exception restoring {display_name}: {e}")
            
    logging.info(f"--- Restoration Complete ---")
    logging.info(f"Restored: {restored_count}")
    logging.info(f"Skipped (Already Exists): {skipped_count}")

if __name__ == "__main__":
    restore_employees()
