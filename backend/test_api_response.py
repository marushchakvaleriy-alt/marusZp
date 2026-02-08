"""
Тест: Що повертає API для нового замовлення Марущака
"""

import requests
import json

# Login
login_data = {"username": "admin", "password": "admin"}
response = requests.post("http://localhost:8000/token", data=login_data)
token = response.json()["access_token"]

headers = {"Authorization": f"Bearer {token}"}

# Get orders
response = requests.get("http://localhost:8000/orders/", headers=headers)
orders = response.json()

print("\n" + "="*70)
print("ЗАМОВЛЕННЯ МАРУЩАКА:")
print("="*70)

for order in orders:
    if order.get('constructor_id') == 1:  # Assuming Marushchak is ID 1
        print(f"\n📦 {order['name']} (ID: {order['id']})")
        print(f"   Ціна: {order['price']}")
        print(f"   Bonus: {order['bonus']}")
        print(f"   Етап I: {order['advance_amount']}")
        print(f"   Етап II: {order.get('final_amount', 'N/A')}")
        
        # Check if it's correct
        if order['advance_amount'] == order['bonus']:
            print(f"   ✅ ПРАВИЛЬНО (100% після Етап I)")
        elif order['advance_amount'] == order['bonus'] / 2:
            print(f"   ❌ НЕПРАВИЛЬНО (50/50 розподіл)")

print("\n" + "="*70)
