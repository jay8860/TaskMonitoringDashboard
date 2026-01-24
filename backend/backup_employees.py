import requests
import json
import logging
import datetime

# Configuration
PROD_API_URL = "https://taskmonitoringdashboard-production.up.railway.app/api/employees/"
BACKUP_FILE = "employee_backup.json"

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def backup_employees():
    logging.info(f"Backing up employees from {PROD_API_URL}...")
    try:
        response = requests.get(PROD_API_URL, timeout=10)
        if response.status_code == 200:
            data = response.json()
            count = len(data)
            
            # Save to file
            with open(BACKUP_FILE, 'w') as f:
                json.dump(data, f, indent=4)
                
            logging.info(f"✅ Successfully backed up {count} employees to {BACKUP_FILE}")
            return count
        else:
            logging.error(f"❌ Failed to fetch data. Status: {response.status_code}")
    except Exception as e:
        logging.error(f"❌ Error during backup: {e}")
    return 0

if __name__ == "__main__":
    backup_employees()
