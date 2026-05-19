import requests
import json
import os

BASE_URL = "http://localhost:8000"
PDF_PATH = "dummy.pdf"

def get_resume_id():
    # Helper to get a valid resume ID by uploading a file
    if not os.path.exists(PDF_PATH):
        print(f"Error: {PDF_PATH} not found. Please create dummy.pdf first.")
        return None

    with open(PDF_PATH, "rb") as f:
        files = {"file": ("dummy.pdf", f, "application/pdf")}
        try:
            response = requests.post(f"{BASE_URL}/upload", files=files)
            response.raise_for_status()
            return response.json().get("id")
        except Exception as e:
            print("Upload Failed:", e)
            return None

def test_chat(resume_id):
    print(f"\nTesting /chat/ask with resume_id={resume_id}...")
    
    # Test 1: General Greeting
    payload = {
        "resume_id": resume_id,
        "message": "Hi, can you help me with my resume?",
        "history": []
    }
    
    try:
        response = requests.post(f"{BASE_URL}/chat/ask", json=payload)
        response.raise_for_status()
        print("Chat Response (Greeting):", json.dumps(response.json(), indent=2))
    except Exception as e:
        print("Chat Failed (Greeting):", e)
        if 'response' in locals():
            print("Response:", response.text)

    # Test 2: Specific Question (Context Retrieval)
    payload = {
        "resume_id": resume_id,
        "message": "What is the email address on this resume?",
        "history": [{"role": "user", "content": "Hi"}, {"role": "ai", "content": "Hello! How can I help?"}]
    }
    
    try:
        response = requests.post(f"{BASE_URL}/chat/ask", json=payload)
        response.raise_for_status()
        print("Chat Response (Specific):", json.dumps(response.json(), indent=2))
    except Exception as e:
        print("Chat Failed (Specific):", e)
        if 'response' in locals():
            print("Response:", response.text)

if __name__ == "__main__":
    resume_id = get_resume_id()
    if resume_id:
        test_chat(resume_id)
