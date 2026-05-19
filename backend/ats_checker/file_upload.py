import os
from fastapi import FastAPI, File, UploadFile, HTTPException
from typing import List

app = FastAPI()

UPLOAD_DIR = "uploads/"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/upload/")
async def upload_file(files: List[UploadFile]):
    for file in files:
        if file.content_type not in ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")
        with open(os.path.join(UPLOAD_DIR, file.filename), "wb") as f:
            f.write(await file.read())
    return {"uploaded_files": [file.filename for file in files]}