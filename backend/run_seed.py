from seed_auth import seed_admin

if __name__ == "__main__":
    print("Running manual seed...")
    try:
        seed_admin()
        print("Manual seed finished.")
    except Exception as e:
        print(f"Manual seed failed: {e}")
