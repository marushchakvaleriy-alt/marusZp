import requests
import json

BASE_URL = "http://localhost:8000"

def test_logging():
    print("Testing Activity Log...")
    
    # 1. Create Order
    order_data = {
        "name": "Log Test Order",
        "price": 1000
    }
    print("Creating order...")
    res = requests.post(f"{BASE_URL}/orders/", json=order_data)
    if res.status_code != 200:
        print(f"Failed to create order: {res.text}")
        return
    order_id = res.json()['id']
    print(f"Order created: {order_id}")

    # 2. Check Logs
    print("Checking logs...")
    res = requests.get(f"{BASE_URL}/logs")
    logs = res.json()
    
    found = False
    for log in logs:
        print(f"Log: {log['action_type']} - {log['description']}")
        if log['action_type'] == "CREATE_ORDER" and str(order_id) in log['description']:
            found = True
            print("SUCCESS: Log entry found!")
            break
            
    if not found:
        print("FAILURE: Log entry not found.")

    # 3. Cleanup
    print("Cleaning up...")
    requests.delete(f"{BASE_URL}/orders/{order_id}")
    
    # Check delete log
    res = requests.get(f"{BASE_URL}/logs")
    logs = res.json()
    if logs[0]['action_type'] == "DELETE_ORDER":
        print("SUCCESS: Delete log found!")
    else:
        print("FAILURE: Delete log not found at top.")

if __name__ == "__main__":
    test_logging()
