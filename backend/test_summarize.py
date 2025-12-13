import requests
import time

API_URL = "http://localhost:8000/api/summarize"

SAMPLE_TEXT = "The quick brown fox jumps over the lazy dog. " * 20

def test_summarize():
    print(f"Testing {API_URL}...")
    try:
        start = time.time()
        res = requests.post(API_URL, json={"text": SAMPLE_TEXT}, timeout=10)
        print(f"Status Code: {res.status_code}")
        print(f"Response: {res.text}")
        print(f"Time: {time.time() - start:.2f}s")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_summarize()
