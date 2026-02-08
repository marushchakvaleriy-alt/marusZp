import sqlite3

conn = sqlite3.connect('database.db')
cursor = conn.cursor()

cursor.execute("SELECT username, full_name, payment_stage1_percent, payment_stage2_percent FROM user WHERE full_name LIKE '%арущак%' OR username LIKE '%arushak%'")

results = cursor.fetchall()

if not results:
    print("❌ Марущака не знайдено в БД!")
else:
    for row in results:
        username, full_name, stage1, stage2 = row
        print(f"\n✅ Знайдено: {full_name} ({username})")
        print(f"   Етап I: {stage1}%")
        print(f"   Етап II: {stage2}%")
        
        if stage1 == 100.0 and stage2 == 0.0:
            print("   ✅ ПРАВИЛЬНО!")
        else:
            print(f"   ❌ НЕПРАВИЛЬНО! Має бути 100/0")

conn.close()
