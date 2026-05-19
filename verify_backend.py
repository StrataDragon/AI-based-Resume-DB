import requests
import json
import os

BASE_URL = "http://localhost:8000"
PDF_PATH = "dummy.pdf"

def test_upload():
    print("Testing /upload...")
    if not os.path.exists(PDF_PATH):
        print(f"Error: {PDF_PATH} not found.")
        return None

    with open(PDF_PATH, "rb") as f:
        files = {"file": ("dummy.pdf", f, "application/pdf")}
        try:
            response = requests.post(f"{BASE_URL}/upload", files=files)
            response.raise_for_status()
            data = response.json()
            print("Upload Success:", json.dumps(data, indent=2))
            return data.get("id")
        except Exception as e:
            print("Upload Failed:", e)
            print("Response:", response.text if 'response' in locals() else "No response")
            return None

def test_chat(resume_id):
    if not resume_id:
        print("Skipping chat test due to missing resume_id.")
        return

    print(f"\nTesting /chat/edit/{resume_id}...")
    payload = {"instruction": "Add 'Machine Learning' to the skills list."}
    try:
        response = requests.post(f"{BASE_URL}/chat/edit/{resume_id}", json=payload)
        response.raise_for_status()
        print("Chat/Edit Success:", json.dumps(response.json(), indent=2))
    except Exception as e:
        print("Chat/Edit Failed:", e)
        print("Response:", response.text if 'response' in locals() else "No response")

if __name__ == "__main__":
    resume_id = test_upload()
    if resume_id:
        test_chat(resume_id)
