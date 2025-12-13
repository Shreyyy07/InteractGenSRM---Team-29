import requests
import json
import time

API_URL = "http://localhost:8000/api/suggest"

# Mock text of a product page
SAMPLE_TEXT = """
Apple iPhone 15 Pro Max. 
The ultimate iPhone. 
Forged in titanium. 
A17 Pro chip. 
All-new Action button. 
48MP Main camera. 
Price: $1199. 
Free shipping on orders over $50.
Customer Reviews: 4.8 stars out of 5.
"""

def test_suggestion():
    print(f"Testing {API_URL} with sample product text...")
    
    payload = {"text": SAMPLE_TEXT}
    
    try:
        start_time = time.time()
        response = requests.post(API_URL, json=payload)
        duration = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ Success! (took {duration:.2f}s)")
            print("-" * 40)
            print(f"Summary: {data.get('summary')}")
            print("Suggestions:")
            for s in data.get('suggestions', []):
                print(f"  - {s}")
            print("-" * 40)
            print(f"Method Used: {data.get('method')}")
        else:
            print(f"❌ Failed: {response.status_code} - {response.text}")

    except Exception as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    test_suggestion()
