from database import SessionLocal, engine
import models

# Data Format: (Assigned To (Display Name), Name, Mobile)
EMPLOYEE_DATA = [
    ("CSEB", "D R Urwasha", "9406355503"),
    ("Aditya DMF", "Aditya", "8600277944"),
    ("Alka Mahobia DMF", "Alka", "9407799442"),
    ("Sanket Joshi DMF", "Sanket", "9763132744"),
    ("PPIA", "Divya PPIA", ""),
    ("APO Nirman", "Surendra Netam", ""),
    ("AO", "Pramodh Durgam", "9340587624"),
    ("DCSBM", "Mamta Rana", "9407774544"),
    ("DPM MIS", "Devendra Sahu", "9171232611"),
    ("DPM SMIB", "Umesh Pal", "9753958068"),
    ("DPM Fin.", "Balnaresh Rao", "9131312622"),
    ("DPM Livelihood", "Nitesh Dewangan", "8109733137"),
    ("LDM", "Shivram Baghel", "942559525"),
    ("EE WRD", "Rakesh Beck", "9425596951"),
    ("CEO JP Dantewada", "Pradeep Patel", "8871672472"),
    ("CEO JP Geedam", "Balram Dhruw", "8305925185"),
    ("CEO JP Kuakonda", "M R Kahyap", "9425501759"),
    ("CEO JP katekalayn", "Ashish Dey", "9244249975"),
    ("CMO Dantewada", "VK Paldas", "9340755336"),
    ("EE PWD", "SHIV LAL THAKUR", "9425562936"),
    ("EE PHE", "NIKHIL KANWAR", "8839664758"),
    ("EE RES", "A R Khare", "7489948542"),
    ("LABOUR OFFICER", "Raja Ram Pal", "9926170543"),
    ("DISTRICT REGISTRAR", "M.R. BHUARYA", "9424154594"),
    ("DDP", "MITHLESH KISHAN", "6260297046"),
    ("DDSW", "DDP", ""),
    ("DD AGRICULTURE", "SURAJ PANSARI", "9406484101"),
    ("DD/AD Horti", "Meena Mandavi", ""),
    ("DD VET", "Dr. Shyama Malviya", "9406470178"),
    ("DPO WCD", "VARUN NAGESH", "7000750918"),
    ("AD FISHRIES", "Deepak Baghel", "9589929815"),
    ("MINING OFFICER", "Yogendra Singh", "9516209072"),
    ("RTO", "GAURAV PATLE", "9399646779"),
    ("EXCISE OFFICER", "Deepak Baghel", "9685134048"),
    ("FOOD OFFICER", "KIRTI KUMAR KAUSIK", "8319900854"),
    ("PRO", "RANJIT PUJARI", "8839216016"),
    ("GM DIC", "FILIP TIGGA", "9424180536"),
    ("AC Tribal", "Rajiv Nag", "87702324709"),
    ("DEO", "Pramod Thkaur", "9425216666"),
    ("DMC", "Harish Gautam", "9399141481"),
    ("EE PMGSY", "Vaibhav Dewangan", "8839581541"),
    ("DIO NIC", "Lavkush Chouhan", "8887004727"),
    ("EDM", "ASHISH VERMA", "9179586858"),
    ("TO", "Chaman Joshi", "8357977990"),
    ("AD HORTICULTURE", "Meena Mandavi", "9425290122"),
    ("AD SERICULTURE", "RAMSURAT BEK", "9669282636"),
    ("CMHO", "Dr. Ajay Ramteke", "6268245 010"),
    ("Civil Surgeon", "Abhay tomar", "9131627968"),
    ("DPSO", "C LAKRA", "9617477819"),
    ("AD CSSDA", "AMIT VERMA", "6268727142"),
    ("CEO ANTYAVYASAI", "JITENDRA KUMAR BAGHEL", "9406266165"),
    ("Pradeep", "Pradeep ASO", "9424279086"),
    ("Employment officer", "AMIT VERMA", "6268727142"),
    ("EE CREDA", "Ravikant Bhardwaj", "9926140186"),
    ("SDO EnM", "Gajendra Duwasa", "8839425778"),
    ("SDO BSNL", "Kamlesh", "9411103788"),
    ("APO NREGA", "Tarun", "9479275877"),
    ("Principal livelihood", "Harish Sinha", "9406334109"),
    ("Commandant", "", ""),
    ("LDM", "Shivram Baghel", "942559525"),
    ("Korram Steno", "Ramlal Korram", "8770238156"),
    ("Steno1", "Priyanka", ""),
    ("CMO Dnt", "VK Paldas", "9340755336"),
    ("CMO Kirandul", "Bhushan Mahapatra", "9179016767"),
    ("CMO Bacheli", "Krishna Rao", "7694078740"),
    ("CMO Geedam", "Hulsi Pradhan", "8629906274"),
    ("CMO Barsoor", "Girish tiwari", "7222904422"),
    ("BPM DNT", "Dharmendra Thakur", "7000528307"),
    ("BPM GDM", "Vaibhav Shesh", "8839056869"),
    ("BPM KUA", "Bhajan Yadav", "9407910349"),
    ("BPM KTK", "Sushil Bara", "7587377255"),
    ("PONREGA DNT", "Gajendra", ""),
    ("PONREGA GDM", "Bhupendar Telami", "9111457557"),
    ("PONREGA KUA", "Manoj Sinha", "9406071141"),
    ("PONREGA KTK", "Tulesh Netam", "9479065216"),
    ("APO Rathore", "Raj kishor Rathore", "9425272475")
]

def seed_employees():
    # Ensure tables exist
    models.Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Clear existing data
        print("Clearing existing employees...")
        db.query(models.Employee).delete()
        db.commit()

        # Track seen display_names to handle list duplicates
        seen = set()
        count = 0
        for display_name, name, mobile in EMPLOYEE_DATA:
            if display_name in seen:
                print(f"Skipping duplicate: {display_name}")
                continue
            
            seen.add(display_name)
            
            # Simple fallback for empty name
            if not name:
                name = display_name
                
            emp = models.Employee(
                name=name, 
                mobile=mobile if mobile else None, 
                display_name=display_name
            )
            db.add(emp)
            count += 1
        
        db.commit()
        print(f"Successfully seeded {count} employees.")
    except Exception as e:
        print(f"Error seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_employees()
