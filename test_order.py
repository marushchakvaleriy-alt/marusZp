import requests
import json

url = "http://localhost:8000/orders/"
data = {
    "name": "Тест замовлення",
    "price": 10000,
    "product_types": json.dumps(["Кухня", "Шафа"]),
    "date_received": "2024-01-27"
}

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
