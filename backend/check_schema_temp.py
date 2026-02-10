import sqlite3
try:
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # List tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables:", tables)
    
    # Check 'order' table columns
    try:
        cursor.execute('PRAGMA table_info("order")')
        columns = [row[1] for row in cursor.fetchall()]
        print("Order Columns:", columns)
        
        if 'date_installation_plan' in columns:
            print("SUCCESS: date_installation_plan exists!")
        else:
            print("FAILURE: date_installation_plan is MISSING!")
    except Exception as e:
        print(f"Error checking order table: {e}")
        
except Exception as e:
    print(f"Database error: {e}")
finally:
    if 'conn' in locals():
        conn.close()
