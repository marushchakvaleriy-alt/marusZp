import requests

# Запустити перерозподіл платежів
response = requests.post("http://localhost:8000/payments/redistribute")
print(response.json())
