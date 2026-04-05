import os
from sqlmodel import Session
from sqlalchemy import text
from database import engine

tables = ['"user"', '"order"', 'payment', 'deduction', 'activitylog', 'paymentallocation', 'orderfile']

print("Connecting to DB to fix sequences...")
try:
    with Session(engine) as session:
        for table in tables:
            seq_name = table.replace('"', '') + '_id_seq'
            try:
                # Get max ID
                result = session.exec(text(f"SELECT MAX(id) FROM {table}")).first()
                max_id = result[0] if result and result[0] is not None else 0
                next_id = max_id + 1
                
                # Set sequence
                sql = f"SELECT setval('{seq_name}', {next_id}, false);"
                session.exec(text(sql))
                print(f"✅ Fixed {table} -> next ID: {next_id}")
            except Exception as e:
                print(f"❌ Failed {table}: {e}")
                session.rollback()
        
        session.commit()
        print("\n🎉 All sequences updated successfully!")
except Exception as e:
    print(f"CRITICAL ERROR: {e}")
