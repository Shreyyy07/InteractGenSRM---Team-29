import requests
import json

try:
    print("Testing /api/summarize with gemini-2.5-flash...")
    res = requests.post("http://localhost:8000/api/summarize", json={"text": "This is a test of the API."})
    if res.status_code == 200:
        print("Success:", res.json())
    else:
        print("Error:", res.text)
except Exception as e:
    print("Request Failed:", e)
