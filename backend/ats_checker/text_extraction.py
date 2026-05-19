from pathlib import Path
from typing import List

from docx import Document
from pypdf import PdfReader


def _extract_pdf_text(file_path: str) -> str:
    reader = PdfReader(file_path)
    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception:
            pass

    pages = []
    for page in reader.pages:
        page_text = (page.extract_text() or "").strip()
        if page_text:
            pages.append(page_text)

    return "\n".join(pages).strip()


def _extract_docx_text(file_path: str) -> str:
    doc = Document(file_path)
    paragraphs = [(p.text or "").strip() for p in doc.paragraphs]
    lines = [p for p in paragraphs if p]
    return "\n".join(lines).strip()

def extract_text_from_file(file_path: str) -> str:
    extension = Path(file_path).suffix.lower()
    try:
        if extension == ".pdf":
            text = _extract_pdf_text(file_path)
        elif extension == ".docx":
            text = _extract_docx_text(file_path)
        else:
            # Optional fallback for uncommon formats.
            import textract  # type: ignore

            text = textract.process(file_path).decode("utf-8")

        if not text:
            raise ValueError("No readable text extracted.")

        return text
    except Exception as e:
        raise ValueError(f"Error extracting text from {file_path}: {e}")

def extract_text_from_files(file_paths: List[str]) -> List[str]:
    extracted_texts = []
    for file_path in file_paths:
        extracted_texts.append(extract_text_from_file(file_path))
    return extracted_texts
