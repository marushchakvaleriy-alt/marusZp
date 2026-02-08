import sqlite3

conn = sqlite3.connect('database.db')
cursor = conn.cursor()

print(f"{'ID':<5} {'Username':<15} {'Full Name':<20} {'Role':<12} {'Stage1 %':<10}")
print("-" * 65)

cursor.execute("SELECT id, username, full_name, role, payment_stage1_percent FROM user")
for row in cursor.fetchall():
    print(f"{row[0]:<5} {row[1]:<15} {row[2]:<20} {row[3]:<12} {row[4]:<10}")

conn.close()
