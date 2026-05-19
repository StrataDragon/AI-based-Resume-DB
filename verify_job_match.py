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

def test_job_match(resume_id):
    print(f"\nTesting /analyze/job-match with resume_id={resume_id}...")
    
    payload = {
        "resume_id": resume_id,
        "job_description": "We are looking for a Senior Software Engineer with experience in Python, React, and Machine Learning. The candidate should be able to build scalable backend systems."
    }
    
    try:
        response = requests.post(f"{BASE_URL}/analyze/job-match", json=payload)
        response.raise_for_status()
        print("Job Match Success:", json.dumps(response.json(), indent=2))
    except Exception as e:
        print("Job Match Failed:", e)
        if 'response' in locals():
            print("Response:", response.text)

if __name__ == "__main__":
    resume_id = get_resume_id()
    if resume_id:
        test_job_match(resume_id)
