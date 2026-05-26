import os
import shutil
import uuid
import sys
import re
from datetime import datetime
from typing import Any, Dict, List

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

try:
    from .audit import register_audit_listeners
    from .ats_checker.file_upload import app as file_upload_app

    from .database import Base, engine, get_db
    from .logic import (
        analyze_job_match,
        build_innovation_lab,
        calculate_semantic_score,
        chat_with_resume,
        edit_resume,
        enrich_structured_data_with_text_hints,
        generate_resume_docx,
        get_dashboard_stats,
        normalize_skill,
        parse_resume,
        query_resume_context,
    )
    from .models import (
        Candidate,
        AuditLog,
        JDSkill,
        JobDescription,
        MatchResult,
        Resume,
        ResumeSkill,
        ResumeVersion,
        Skill,
    )
    from .schemas import (
        CandidateSummary,
        AuditLogEntry,
        ChatEditRequest,
        JobDescriptionCreate,
        MatchRequest,
        MatchResponse,
        TailorResumeRequest,
    )
except ImportError:
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from audit import register_audit_listeners
    from ats_checker.file_upload import app as file_upload_app

    from database import Base, engine, get_db
    from logic import (
        analyze_job_match,
        build_innovation_lab,
        calculate_semantic_score,
        chat_with_resume,
        edit_resume,
        enrich_structured_data_with_text_hints,
        generate_resume_docx,
        get_dashboard_stats,
        normalize_skill,
        parse_resume,
        query_resume_context,
    )
    from models import (
        Candidate,
        AuditLog,
        JDSkill,
        JobDescription,
        MatchResult,
        Resume,
        ResumeSkill,
        ResumeVersion,
        Skill,
    )
    from schemas import (
        CandidateSummary,
        AuditLogEntry,
        ChatEditRequest,
        JobDescriptionCreate,
        MatchRequest,
        MatchResponse,
        TailorResumeRequest,
    )

Base.metadata.create_all(bind=engine)
register_audit_listeners()


def _run_lightweight_migrations() -> None:
    inspector = inspect(engine)
    if "job_descriptions" in inspector.get_table_names():
        existing_cols = {col["name"] for col in inspector.get_columns("job_descriptions")}
        to_add = []
        if "company" not in existing_cols:
            to_add.append("ALTER TABLE job_descriptions ADD COLUMN company VARCHAR")
        if "seniority" not in existing_cols:
            to_add.append("ALTER TABLE job_descriptions ADD COLUMN seniority VARCHAR")
        if "industry" not in existing_cols:
            to_add.append("ALTER TABLE job_descriptions ADD COLUMN industry VARCHAR")

        if to_add:
            with engine.begin() as conn:
                for ddl in to_add:
                    conn.execute(text(ddl))


_run_lightweight_migrations()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

DEFAULT_JOB_DESCRIPTIONS = [
    {
        "title": "Backend Python Engineer",
        "company": "CloudSprint",
        "seniority": "Mid-Level",
        "industry": "SaaS",
        "description": (
            "Build and maintain FastAPI microservices, design PostgreSQL-backed APIs, "
            "optimize background jobs, and collaborate with frontend and data teams to ship "
            "scalable product features. Strong ownership of testing, CI/CD, and observability is expected."
        ),
        "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "REST", "Git", "CI/CD", "AWS"],
    },
    {
        "title": "Java Spring Boot Developer",
        "company": "FinEdge Systems",
        "seniority": "Associate",
        "industry": "FinTech",
        "description": (
            "Develop secure Spring Boot services for financial workflows, integrate SQL databases, "
            "write maintainable APIs, and support deployment automation for highly available backend systems."
        ),
        "required_skills": ["Java", "Spring", "SQL", "Microservices", "Docker", "Git", "Linux", "REST"],
    },
    {
        "title": "Machine Learning Engineer",
        "company": "InsightForge AI",
        "seniority": "Mid-Level",
        "industry": "AI/ML",
        "description": (
            "Train and deploy machine learning models, prepare datasets, build evaluation pipelines, "
            "and collaborate with product teams to productionize recommendation and ranking systems."
        ),
        "required_skills": ["Python", "Machine Learning", "Pandas", "NumPy", "Scikit-Learn", "SQL", "Docker", "AWS"],
    },
    {
        "title": "Data Analyst",
        "company": "RetailPulse",
        "seniority": "Junior",
        "industry": "Retail Analytics",
        "description": (
            "Analyze customer and sales data, build dashboards, write SQL queries, and present actionable "
            "insights to business stakeholders using modern BI tooling."
        ),
        "required_skills": ["SQL", "Excel", "Tableau", "Power BI", "Python", "Pandas"],
    },
    {
        "title": "Frontend React Developer",
        "company": "StudioNova",
        "seniority": "Mid-Level",
        "industry": "Product Engineering",
        "description": (
            "Create polished React interfaces, integrate REST APIs, improve performance, and collaborate "
            "with designers to deliver responsive, production-ready web experiences."
        ),
        "required_skills": ["JavaScript", "TypeScript", "React", "REST", "Git", "CSS"],
    },
    {
        "title": "Cloud DevOps Engineer",
        "company": "InfraOrbit",
        "seniority": "Senior",
        "industry": "Cloud Infrastructure",
        "description": (
            "Own cloud infrastructure, automate deployments, manage containers, and build reliable "
            "observability and platform tooling for engineering teams."
        ),
        "required_skills": ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD", "Linux", "Python"],
    },
]

SKILL_CATEGORY_MAP = {
    "python": "Language",
    "java": "Language",
    "javascript": "Language",
    "typescript": "Language",
    "sql": "Database",
    "postgresql": "Database",
    "excel": "Analytics",
    "tableau": "Analytics",
    "power bi": "Analytics",
    "pandas": "Data",
    "numpy": "Data",
    "scikit-learn": "ML",
    "machine learning": "ML",
    "fastapi": "Framework",
    "spring": "Framework",
    "react": "Frontend",
    "rest": "API",
    "microservices": "Architecture",
    "git": "Tooling",
    "docker": "DevOps",
    "kubernetes": "DevOps",
    "terraform": "DevOps",
    "ci/cd": "DevOps",
    "aws": "Cloud",
    "linux": "Platform",
    "css": "Frontend",
}


def _dedupe_skills(skills: List[str]) -> List[str]:
    seen = set()
    output = []
    for raw in skills:
        value = (raw or "").strip()
        if not value:
            continue
        key = normalize_skill(value)
        if key in seen:
            continue
        seen.add(key)
        output.append(value)
    return output


def _skill_category(skill_name: str) -> str | None:
    return SKILL_CATEGORY_MAP.get(normalize_skill(skill_name))


def _seed_default_job_descriptions() -> None:
    db = next(get_db())
    try:
        existing = db.query(JobDescription).count()
        if existing > 0:
            return

        for payload in DEFAULT_JOB_DESCRIPTIONS:
            required_skills = _dedupe_skills(payload["required_skills"])
            jd = JobDescription(
                title=payload["title"],
                company=payload["company"],
                seniority=payload["seniority"],
                industry=payload["industry"],
                description=payload["description"],
                required_skills=required_skills,
            )
            db.add(jd)
            db.flush()

            for skill_name in required_skills:
                db.add(JDSkill(jd_id=jd.id, skill_name=skill_name, is_required=True))

                normalized = normalize_skill(skill_name)
                existing_skill = db.query(Skill).filter(Skill.name == normalized).first()
                if existing_skill:
                    if not existing_skill.category:
                        existing_skill.category = _skill_category(skill_name)
                else:
                    db.add(
                        Skill(
                            name=normalized,
                            category=_skill_category(skill_name),
                        )
                    )

        db.commit()
    finally:
        db.close()


_seed_default_job_descriptions()


def _sync_resume_skills(db: Session, resume_id: int, skills: List[str]) -> None:
    db.query(ResumeSkill).filter(ResumeSkill.resume_id == resume_id).delete()

    for skill_name in _dedupe_skills(skills):
        normalized = normalize_skill(skill_name)
        skill = db.query(Skill).filter(Skill.name.ilike(normalized)).first()
        if not skill:
            skill = Skill(name=skill_name)
            db.add(skill)
            db.flush()
        db.add(ResumeSkill(resume_id=resume_id, skill_id=skill.id))


def _ensure_candidate(db: Session, structured_data: dict) -> int | None:
    email = (structured_data.get("email") or "").strip().lower()
    name = (structured_data.get("name") or "").strip()
    phone = (structured_data.get("phone") or "").strip()

    if not email:
        return None

    candidate = db.query(Candidate).filter(Candidate.email == email).first()
    if candidate:
        if name and candidate.name != name:
            candidate.name = name
        if phone and candidate.phone != phone:
            candidate.phone = phone
        return candidate.id

    candidate = Candidate(name=name or email.split("@")[0], email=email, phone=phone or None)
    db.add(candidate)
    db.flush()
    return candidate.id


def _get_jd_required_skills(db: Session, jd: JobDescription) -> List[str]:
    jd_skills = [row.skill_name for row in db.query(JDSkill).filter(JDSkill.jd_id == jd.id, JDSkill.is_required == True).all()]
    return _dedupe_skills(jd_skills if jd_skills else (jd.required_skills or []))


def _get_resume_skill_set(resume: Resume) -> set[str]:
    skill_set: set[str] = set()
    structured = resume.structured_data if isinstance(resume.structured_data, dict) else {}
    for skill in structured.get("skills", []) if isinstance(structured.get("skills"), list) else []:
        normalized = normalize_skill(skill)
        if normalized:
            skill_set.add(normalized)
    return skill_set


def _compute_match_payload(db: Session, resume: Resume, jd: JobDescription) -> Dict[str, Any]:
    jd_skills = _get_jd_required_skills(db, jd)
    resume_skill_names = _get_resume_skill_set(resume)

    matched_skills = [skill for skill in jd_skills if normalize_skill(skill) in resume_skill_names]
    missing_skills = [skill for skill in jd_skills if normalize_skill(skill) not in resume_skill_names]
    total_required = len(jd_skills)
    match_score = round((len(matched_skills) / total_required) * 100, 2) if total_required > 0 else 0.0
    semantic_score = calculate_semantic_score(resume.raw_text or "", jd.description or "")

    recommendation = (
        f"Add missing skills: {', '.join(missing_skills[:6])}."
        if missing_skills
        else "Strong fit. Focus on quantifiable impact and role-specific achievements."
    )

    return {
        "jd_skills": jd_skills,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "match_score": match_score,
        "semantic_score": semantic_score,
        "recommendation": recommendation,
    }


def _save_match_result(db: Session, resume_id: int, jd_id: int, payload: Dict[str, Any]) -> MatchResult:
    result = MatchResult(
        resume_id=resume_id,
        jd_id=jd_id,
        match_score=payload["match_score"],
        matched_skills=payload["matched_skills"],
        missing_skills=payload["missing_skills"],
        semantic_score=payload["semantic_score"],
        recommendation=payload["recommendation"],
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


def _text_quality_signals(resume: Resume) -> Dict[str, float]:
    raw_text = resume.raw_text or ""
    lower_text = raw_text.lower()

    section_keywords = ["experience", "education", "skills", "projects", "summary"]
    section_hits = sum(1 for key in section_keywords if key in lower_text)
    section_score = min(100.0, (section_hits / len(section_keywords)) * 100)

    has_email = bool(re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", raw_text))
    has_phone = bool(re.search(r"(\+?\d[\d\-\s()]{7,}\d)", raw_text))
    contact_score = 100.0 if has_email and has_phone else 60.0 if has_email or has_phone else 25.0

    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
    avg_line_len = (sum(len(ln) for ln in lines) / len(lines)) if lines else 0
    readability_score = 88.0 if 35 <= avg_line_len <= 110 else 70.0 if 20 <= avg_line_len <= 140 else 52.0

    long_line_penalty = 12.0 if any(len(ln) > 220 for ln in lines) else 0.0
    odd_char_penalty = 8.0 if re.search(r"[^\x00-\x7F]", raw_text) else 0.0
    format_score = max(35.0, 90.0 - long_line_penalty - odd_char_penalty)

    quantified_hits = len(re.findall(r"(\d+%|\$\d+|\d+\+?)", raw_text))
    impact_score = min(100.0, 40.0 + quantified_hits * 8.0)

    current_year = datetime.utcnow().year
    years = [int(y) for y in re.findall(r"\b(19\d{2}|20\d{2})\b", raw_text)]
    latest_year = max(years) if years else None
    if latest_year and latest_year >= current_year - 2:
        recency_score = 90.0
    elif latest_year and latest_year >= current_year - 5:
        recency_score = 74.0
    else:
        recency_score = 58.0

    return {
        "section_score": round(section_score, 2),
        "contact_score": round(contact_score, 2),
        "readability_score": round(readability_score, 2),
        "format_score": round(format_score, 2),
        "impact_score": round(impact_score, 2),
        "recency_score": round(recency_score, 2),
    }


def _fallback_candidate_score(structured: Dict[str, Any]) -> float:
    score = 0.0
    if structured.get("email"):
        score += 20.0
    if structured.get("phone"):
        score += 20.0
    if structured.get("skills"):
        score += 30.0
    if structured.get("experience"):
        score += 30.0
    return round(score, 2)


def _build_ats_shadow_scores(match_payload: Dict[str, Any], quality: Dict[str, float]) -> List[Dict[str, Any]]:
    keyword = float(match_payload["match_score"])
    semantic = float(match_payload["semantic_score"]) * 100.0

    workday = (
        keyword * 0.55
        + quality["section_score"] * 0.2
        + quality["format_score"] * 0.15
        + quality["contact_score"] * 0.1
    )
    greenhouse = (
        keyword * 0.45
        + semantic * 0.2
        + quality["impact_score"] * 0.15
        + quality["section_score"] * 0.1
        + quality["readability_score"] * 0.1
    )
    lever = (
        keyword * 0.5
        + semantic * 0.1
        + quality["recency_score"] * 0.15
        + quality["contact_score"] * 0.1
        + quality["readability_score"] * 0.15
    )

    return [
        {
            "system": "Workday Shadow",
            "score": round(workday, 2),
            "top_signals": ["Keyword coverage", "Sections detected", "Formatting quality"],
        },
        {
            "system": "Greenhouse Shadow",
            "score": round(greenhouse, 2),
            "top_signals": ["Keyword coverage", "Semantic alignment", "Impact statements"],
        },
        {
            "system": "Lever Shadow",
            "score": round(lever, 2),
            "top_signals": ["Keyword coverage", "Recency signal", "Readability"],
        },
    ]


def _build_skill_radar(match_payload: Dict[str, Any], quality: Dict[str, float], resume_skill_count: int) -> List[Dict[str, float | str]]:
    semantic = float(match_payload["semantic_score"]) * 100.0
    depth = min(100.0, resume_skill_count * 8.0)
    ats_readiness = (quality["format_score"] + quality["section_score"] + quality["contact_score"]) / 3.0

    return [
        {"axis": "Keyword Coverage", "resume": round(float(match_payload["match_score"]), 2), "target": 100.0},
        {"axis": "Semantic Alignment", "resume": round(semantic, 2), "target": 100.0},
        {"axis": "Skill Depth", "resume": round(depth, 2), "target": 85.0},
        {"axis": "Impact Signal", "resume": round(quality["impact_score"], 2), "target": 85.0},
        {"axis": "ATS Readiness", "resume": round(ats_readiness, 2), "target": 90.0},
    ]


def _build_skill_heatmap(db: Session, resume: Resume, selected_jd_id: int) -> Dict[str, Any]:
    resume_skills = _get_resume_skill_set(resume)
    jobs = db.query(JobDescription).order_by(JobDescription.id.desc()).limit(6).all()
    if selected_jd_id not in [job.id for job in jobs]:
        selected = db.query(JobDescription).filter(JobDescription.id == selected_jd_id).first()
        if selected:
            jobs = [selected] + jobs[:5]

    job_required_map: Dict[int, set[str]] = {}
    skill_universe: List[str] = []
    seen = set()
    for job in jobs:
        required = {normalize_skill(s) for s in _get_jd_required_skills(db, job)}
        job_required_map[job.id] = required
        for skill in required:
            if skill and skill not in seen:
                seen.add(skill)
                skill_universe.append(skill)

    skill_universe = skill_universe[:12]
    job_labels = [{"jd_id": job.id, "title": job.title} for job in jobs]

    cells = []
    for skill in skill_universe:
        for job in jobs:
            required = skill in job_required_map[job.id]
            matched = required and skill in resume_skills
            if required and matched:
                intensity = 100
            elif required and not matched:
                intensity = 28
            elif not required and skill in resume_skills:
                intensity = 45
            else:
                intensity = 8

            cells.append(
                {
                    "skill": skill,
                    "jd_id": job.id,
                    "required": required,
                    "matched": matched,
                    "intensity": intensity,
                }
            )

    return {"jobs": job_labels, "skills": skill_universe, "cells": cells}


@app.post("/upload")
async def upload_resume(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = (file.filename or "").lower()
    if not (filename.endswith(".pdf") or filename.endswith(".docx")):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

    file_id = str(uuid.uuid4())
    safe_name = os.path.basename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{safe_name}")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        text, structured_data = parse_resume(file_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resume parsing failed: {e}")

    candidate_id = _ensure_candidate(db, structured_data)
    db_resume = Resume(
        candidate_id=candidate_id,
        file_path=file_path,
        raw_text=text,
        structured_data=structured_data,
        summary=structured_data.get("summary") or None,
    )
    db.add(db_resume)
    db.flush()

    _sync_resume_skills(db, db_resume.id, structured_data.get("skills", []))

    db.commit()
    db.refresh(db_resume)
    return {"id": db_resume.id, "data": structured_data}


@app.post("/chat/edit/{resume_id}")
async def chat_edit_resume(resume_id: int, request: ChatEditRequest, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    retrieved_context = query_resume_context(resume.file_path, request.instruction)
    updated_data = edit_resume(resume.structured_data, request.instruction, context=retrieved_context)

    resume.structured_data = updated_data
    resume.summary = updated_data.get("summary") if isinstance(updated_data, dict) else resume.summary
    _sync_resume_skills(db, resume.id, updated_data.get("skills", []) if isinstance(updated_data, dict) else [])
    db.commit()

    return {"message": "Resume updated", "data": updated_data}


@app.post("/chat/ask")
async def chat_ask(request: dict, db: Session = Depends(get_db)):
    resume_id = request.get("resume_id")
    message = request.get("message")
    history = request.get("history", [])

    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    reply = chat_with_resume(history, message, resume.structured_data)
    return {"reply": reply}


@app.post("/analyze/job-match")
async def analyze_match(request: dict, db: Session = Depends(get_db)):
    resume_id = request.get("resume_id")
    job_description = request.get("job_description")

    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    if not job_description:
        raise HTTPException(status_code=400, detail="job_description is required")

    analysis = analyze_job_match(resume.structured_data, job_description)
    return analysis


@app.post("/api/v1/resumes/{resume_id}/innovation-lab")
async def innovation_lab(resume_id: int, request: dict | None = None, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    payload = request or {}
    job_description = payload.get("job_description", "")
    insights = build_innovation_lab(
        resume_data=resume.structured_data if isinstance(resume.structured_data, dict) else {},
        raw_text=resume.raw_text or "",
        job_description=job_description or "",
    )
    return insights


@app.get("/download/{resume_id}")
async def download_resume(
    resume_id: int,
    template: str = Query(default="current"),
    db: Session = Depends(get_db),
):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    output_path = os.path.join(UPLOAD_DIR, f"updated_{resume_id}.docx")
    try:
        export_data = enrich_structured_data_with_text_hints(resume.structured_data, resume.raw_text or "")
        generate_resume_docx(export_data, output_path, template=template)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating document: {e}")

    return FileResponse(
        output_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=f"updated_resume_{resume_id}.docx",
    )


# ─── PDF Serving & Visual Diff Overlay Endpoints ──────────────────────────────

def _format_resume_content(data: dict) -> str:
    if not data:
        return ""
    lines = []
    
    if data.get("name"):
        lines.append(data.get("name"))
        
    contact = []
    if data.get("email"): contact.append(f"Email: {data.get('email')}")
    if data.get("phone"): contact.append(f"Phone: {data.get('phone')}")
    if data.get("location"): contact.append(f"Location: {data.get('location')}")
    if contact:
        lines.append(" | ".join(contact))
        
    lines.append("--------------------------------------------------")
    lines.append("")
    
    if data.get("summary"):
        lines.append("SUMMARY")
        lines.append("-------")
        lines.append(data.get("summary"))
        lines.append("")
        
    experience = data.get("experience", [])
    if experience and isinstance(experience, list):
        lines.append("EXPERIENCE")
        lines.append("----------")
        for exp in experience:
            company = exp.get("company") or exp.get("institution") or 'Company'
            lines.append(f"Role at {company} | {exp.get('dates', 'Dates')}")
            if exp.get("description"):
                lines.append(exp.get("description"))
        lines.append("")
        
    education = data.get("education", [])
    if education and isinstance(education, list):
        lines.append("EDUCATION")
        lines.append("---------")
        for edu in education:
            school = edu.get("school") or edu.get("institution") or 'Institution'
            lines.append(f"{edu.get('degree', 'Degree')}, {school}")
        lines.append("")
        
    return "\n".join(lines).strip()


def generate_pdf_fallback(content_text: str, pdf_path: str):
    import ast
    import json
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors

    try:
        data = json.loads(content_text)
    except Exception:
        try:
            data = ast.literal_eval(content_text)
        except Exception:
            data = {"summary": content_text}

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=12
    )
    
    heading_style = ParagraphStyle(
        'HeadingStyle',
        parent=styles['Heading2'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#2563EB'),
        spaceBefore=12,
        spaceAfter=6
    )
    
    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6
    )
    
    meta_style = ParagraphStyle(
        'MetaStyle',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748B'),
        spaceAfter=4
    )

    story = []
    
    # Name
    name = data.get("name", "Resume")
    story.append(Paragraph(name, title_style))
    
    contact = []
    if data.get("email"): contact.append(data.get("email"))
    if data.get("phone"): contact.append(data.get("phone"))
    if data.get("location"): contact.append(data.get("location"))
    if contact:
        story.append(Paragraph(" | ".join(contact), body_style))
        story.append(Spacer(1, 10))

    # Summary
    if data.get("summary"):
        story.append(Paragraph("Professional Summary", heading_style))
        story.append(Paragraph(data.get("summary"), body_style))
        story.append(Spacer(1, 10))

    # Experience
    experience = data.get("experience", [])
    if experience and isinstance(experience, list):
        story.append(Paragraph("Work Experience", heading_style))
        for exp in experience:
            title = exp.get("title", "")
            company = exp.get("company", "")
            dates = exp.get("dates", "")
            location = exp.get("location", "")
            
            header_text = f"<b>{title}</b>"
            if company:
                header_text += f" | <i>{company}</i>"
            story.append(Paragraph(header_text, body_style))
            
            meta_text = " • ".join(filter(None, [dates, location]))
            if meta_text:
                story.append(Paragraph(meta_text, meta_style))
            
            desc = exp.get("description", "")
            if desc:
                for bullet in desc.split('\n'):
                    bullet = bullet.strip().lstrip("-*• ").strip()
                    if bullet:
                        story.append(Paragraph(f"• {bullet}", body_style))
            story.append(Spacer(1, 6))

    # Education
    education = data.get("education", [])
    if education and isinstance(education, list):
        story.append(Paragraph("Education", heading_style))
        for edu in education:
            degree = edu.get("degree", "")
            school = edu.get("school", "")
            year = edu.get("year", "")
            cgpa = edu.get("cgpa", "")
            
            edu_text = f"<b>{degree}</b> | {school}"
            story.append(Paragraph(edu_text, body_style))
            
            meta_bits = [year, f"CGPA: {cgpa}" if cgpa else ""]
            meta_line = " | ".join(bit for bit in meta_bits if bit)
            if meta_line:
                story.append(Paragraph(meta_line, meta_style))
            story.append(Spacer(1, 6))

    # Skills
    skills = data.get("skills", [])
    if skills:
        story.append(Paragraph("Skills", heading_style))
        skills_text = ", ".join(skills) if isinstance(skills, list) else str(skills)
        story.append(Paragraph(skills_text, body_style))

    doc.build(story)


def _convert_docx_to_pdf(docx_path: str, pdf_path: str, content_text: str):
    import subprocess
    try:
        soffice_cmd = "soffice"
        if os.name == 'nt':
            prog_files = os.environ.get("ProgramFiles", "C:\\Program Files")
            prog_files_x86 = os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")
            possible_paths = [
                os.path.join(prog_files, "LibreOffice", "program", "soffice.exe"),
                os.path.join(prog_files_x86, "LibreOffice", "program", "soffice.exe"),
            ]
            for p in possible_paths:
                if os.path.exists(p):
                    soffice_cmd = p
                    break
        
        out_dir = os.path.dirname(docx_path)
        subprocess.run(
            [soffice_cmd, "--headless", "--convert-to", "pdf", "--outdir", out_dir, docx_path],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=15
        )
        gen_pdf = docx_path.rsplit(".", 1)[0] + ".pdf"
        if os.path.exists(gen_pdf):
            if gen_pdf != pdf_path:
                shutil.copy2(gen_pdf, pdf_path)
            return
    except Exception as e:
        print(f"LibreOffice PDF conversion failed, falling back to ReportLab: {e}")
    
    try:
        generate_pdf_fallback(content_text, pdf_path)
    except Exception as e:
        print(f"ReportLab PDF generation failed: {e}")
        with open(pdf_path, 'wb') as f:
            f.write(b"%PDF-1.4\n%...\n")


@app.api_route("/api/v1/resumes/{resume_id}/pdf", methods=["GET", "HEAD"])
async def get_resume_pdf(resume_id: int, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    file_path = resume.file_path
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Original resume file not found")
    
    pdf_path = file_path
    if not file_path.lower().endswith(".pdf"):
        pdf_path = file_path.rsplit(".", 1)[0] + ".pdf"
        if not os.path.exists(pdf_path):
            _convert_docx_to_pdf(file_path, pdf_path, resume.raw_text or str(resume.structured_data))
    
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600",
            "Content-Disposition": "inline",
        }
    )


@app.api_route("/api/v1/tailor/{tailor_id}/pdf", methods=["GET", "HEAD"])
async def get_tailored_pdf(tailor_id: int, db: Session = Depends(get_db)):
    version = db.query(ResumeVersion).filter(ResumeVersion.id == tailor_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Tailored version not found")
    
    docx_path = version.file_path
    if not docx_path or not os.path.exists(docx_path):
        raise HTTPException(status_code=404, detail="Tailored DOCX file not found")
    
    pdf_path = docx_path.rsplit(".", 1)[0] + ".pdf"
    if not os.path.exists(pdf_path):
        _convert_docx_to_pdf(docx_path, pdf_path, version.content_text)
        
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600",
            "Content-Disposition": "inline",
        }
    )


@app.get("/api/v1/tailor/{tailor_id}/highlights")
async def get_tailor_highlights(tailor_id: int, db: Session = Depends(get_db)):
    version = db.query(ResumeVersion).filter(ResumeVersion.id == tailor_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Tailored version not found")
        
    resume = db.query(Resume).filter(Resume.id == version.resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Original resume not found")
        
    import ast
    import json
    import difflib
    
    try:
        tailored_data = json.loads(version.content_text)
    except Exception:
        try:
            tailored_data = ast.literal_eval(version.content_text)
        except Exception:
            tailored_data = {}
            
    original_text = _format_resume_content(resume.structured_data or {})
    tailored_text = _format_resume_content(tailored_data)
    
    old_lines = original_text.splitlines()
    new_lines = tailored_text.splitlines()
    
    matcher = difflib.SequenceMatcher(None, old_lines, new_lines)
    highlights = []
    highlight_idx = 0
    
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            continue
            
        change_type = 'modified'
        if tag == 'replace':
            change_type = 'modified'
        elif tag == 'delete':
            change_type = 'removed'
        elif tag == 'insert':
            change_type = 'added'
            
        start_line = j1 if change_type == 'added' else i1
        end_line = j2 if change_type == 'added' else i2
        
        page = (start_line // 54) + 1
        y = 72 + (start_line % 54) * 14
        height = max(14, (end_line - start_line) * 14)
        
        highlights.append({
            "page": page,
            "x": 72,
            "y": y,
            "width": 451,
            "height": height,
            "type": change_type,
            "section": "experience" if start_line > 10 else "summary",
            "changeId": f"ch_{highlight_idx}",
            "confidence": "approximate"
        })
        highlight_idx += 1
        
    return highlights




@app.get("/dashboard/stats")
async def dashboard_stats(db: Session = Depends(get_db)):
    try:
        return get_dashboard_stats(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/job-descriptions")
async def create_job_description(payload: JobDescriptionCreate, db: Session = Depends(get_db)):
    required_skills = _dedupe_skills(payload.required_skills)
    jd = JobDescription(
        title=payload.title,
        company=payload.company,
        seniority=payload.seniority,
        industry=payload.industry,
        description=payload.description,
        required_skills=required_skills,
    )
    db.add(jd)
    db.flush()

    for skill_name in required_skills:
        db.add(JDSkill(jd_id=jd.id, skill_name=skill_name, is_required=True))

    db.commit()
    db.refresh(jd)
    return {
        "jd_id": jd.id,
        "title": jd.title,
        "company": jd.company,
        "seniority": jd.seniority,
        "industry": jd.industry,
        "required_skills": required_skills,
    }


@app.get("/api/v1/job-descriptions")
async def list_job_descriptions(db: Session = Depends(get_db)):
    items = db.query(JobDescription).order_by(JobDescription.id.desc()).all()
    response = []
    for jd in items:
        skill_count = db.query(JDSkill).filter(JDSkill.jd_id == jd.id).count()
        response.append(
            {
                "jd_id": jd.id,
                "title": jd.title,
                "company": jd.company,
                "seniority": jd.seniority,
                "industry": jd.industry,
                "description": jd.description,
                "required_skills": jd.required_skills or [],
                "skill_count": skill_count,
            }
        )
    return response


@app.post("/api/v1/match", response_model=MatchResponse)
async def match_resume_to_jd(payload: MatchRequest, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == payload.resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    jd = db.query(JobDescription).filter(JobDescription.id == payload.jd_id).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found")

    payload_data = _compute_match_payload(db, resume, jd)
    result = _save_match_result(db, resume.id, jd.id, payload_data)

    return MatchResponse(
        match_id=result.id,
        match_score=float(result.match_score),
        matched_skills=payload_data["matched_skills"],
        missing_skills=payload_data["missing_skills"],
        semantic_score=float(result.semantic_score),
        recommendation=payload_data["recommendation"],
    )


@app.post("/api/v1/match/insights")
async def match_insights(payload: MatchRequest, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == payload.resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    jd = db.query(JobDescription).filter(JobDescription.id == payload.jd_id).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found")

    payload_data = _compute_match_payload(db, resume, jd)
    result = _save_match_result(db, resume.id, jd.id, payload_data)

    quality = _text_quality_signals(resume)
    resume_skill_count = len(_get_resume_skill_set(resume))
    radar = _build_skill_radar(payload_data, quality, resume_skill_count)
    ats_shadow = _build_ats_shadow_scores(payload_data, quality)
    heatmap = _build_skill_heatmap(db, resume, jd.id)

    return {
        "match": {
            "match_id": result.id,
            "match_score": float(result.match_score),
            "matched_skills": payload_data["matched_skills"],
            "missing_skills": payload_data["missing_skills"],
            "semantic_score": float(result.semantic_score),
            "recommendation": payload_data["recommendation"],
        },
        "radar": radar,
        "ats_shadow": ats_shadow,
        "heatmap": heatmap,
    }


@app.post("/api/v1/resumes/{resume_id}/tailor")
async def tailor_resume(resume_id: int, payload: TailorResumeRequest, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    jd = db.query(JobDescription).filter(JobDescription.id == payload.jd_id).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found")

    base_instruction = payload.instruction.strip() if payload.instruction else "Tailor this resume for the given role and improve relevance without fabrication."
    fabrication_clause = (
        "Do not invent any new accomplishments, skills, dates, locations, employers, or metrics. "
        "Only rewrite and optimize existing facts from the resume."
    )
    combined_instruction = (
        f"{base_instruction}\n\n{fabrication_clause}\n\nRole: {jd.title}\nCompany: {jd.company or 'N/A'}\n"
        f"Required Skills: {', '.join(jd.required_skills or [])}\n"
        f"Job Description:\n{jd.description}"
    )

    updated_data = edit_resume(resume.structured_data, combined_instruction, context=jd.description or "")
    updated_data = enrich_structured_data_with_text_hints(updated_data, resume.raw_text or "")
    resume.structured_data = updated_data
    resume.summary = updated_data.get("summary") if isinstance(updated_data, dict) else resume.summary
    _sync_resume_skills(db, resume.id, updated_data.get("skills", []) if isinstance(updated_data, dict) else [])

    latest_version = (
        db.query(ResumeVersion)
        .filter(ResumeVersion.resume_id == resume.id)
        .order_by(ResumeVersion.version_no.desc())
        .first()
    )
    next_version = (latest_version.version_no + 1) if latest_version else 1

    output_path = os.path.join(UPLOAD_DIR, f"resume_{resume.id}_jd_{jd.id}_v{next_version}.docx")
    selected_template = (payload.template or "current").strip().lower()
    generate_resume_docx(updated_data, output_path, template=selected_template)

    version = ResumeVersion(
        resume_id=resume.id,
        jd_id=jd.id,
        version_no=next_version,
        content_text=str(updated_data),
        file_path=output_path,
    )
    db.add(version)
    db.commit()
    db.refresh(version)

    return {
        "version_id": version.id,
        "resume_id": resume.id,
        "jd_id": jd.id,
        "version_no": version.version_no,
        "file_path": version.file_path,
        "data": updated_data,
        "template": selected_template,
    }


@app.get("/api/v1/resumes/{resume_id}/versions")
async def list_resume_versions(resume_id: int, db: Session = Depends(get_db)):
    versions = (
        db.query(ResumeVersion)
        .filter(ResumeVersion.resume_id == resume_id)
        .order_by(ResumeVersion.version_no.desc())
        .all()
    )
    return [
        {
            "version_id": row.id,
            "resume_id": row.resume_id,
            "jd_id": row.jd_id,
            "version_no": row.version_no,
            "file_path": row.file_path,
            "created_at": row.created_at,
        }
        for row in versions
    ]


@app.get("/api/v1/candidates", response_model=List[CandidateSummary])
async def list_candidates(search: str = "", db: Session = Depends(get_db)):
    resumes = db.query(Resume).order_by(Resume.id.desc()).all()
    output = []
    query = search.strip().lower()

    for resume in resumes:
        structured = resume.structured_data if isinstance(resume.structured_data, dict) else {}
        name = structured.get("name") or "Unknown Candidate"
        email = structured.get("email") or ""
        skills = structured.get("skills") if isinstance(structured.get("skills"), list) else []
        skill_str = " ".join(skills).lower()

        if query and query not in name.lower() and query not in email.lower() and query not in skill_str:
            continue

        resume_count = db.query(Resume).filter(Resume.candidate_id == resume.candidate_id).count() if resume.candidate_id else 1
        latest_match = (
            db.query(MatchResult)
            .filter(MatchResult.resume_id == resume.id)
            .order_by(MatchResult.id.desc())
            .first()
        )
        score = float(latest_match.match_score) if latest_match else _fallback_candidate_score(structured)

        output.append(
            CandidateSummary(
                resume_id=resume.id,
                name=name,
                email=email,
                top_skills=skills[:5],
                resume_count=resume_count,
                latest_score=score,
            )
        )

    return output


@app.get("/api/v1/audit/logs", response_model=List[AuditLogEntry])
async def get_audit_logs(limit: int = 50, since_id: int | None = None, db: Session = Depends(get_db)):
    safe_limit = max(1, min(limit, 300))

    if since_id is not None:
        rows = (
            db.query(AuditLog)
            .filter(AuditLog.id > since_id)
            .order_by(AuditLog.id.asc())
            .limit(safe_limit)
            .all()
        )
    else:
        rows = (
            db.query(AuditLog)
            .order_by(AuditLog.id.desc())
            .limit(safe_limit)
            .all()
        )
        rows.reverse()

    return [
        AuditLogEntry(
            id=row.id,
            table_name=row.table_name,
            action=row.action,
            record_pk=row.record_pk,
            changed_by=row.changed_by or "system",
            old_values=row.old_values,
            new_values=row.new_values,
            created_at=row.created_at,
        )
        for row in rows
    ]


app.mount("/ats-checker", file_upload_app)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
