from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class SkillBase(BaseModel):
    name: str
    category: Optional[str] = None

class SkillCreate(SkillBase):
    pass

class Skill(SkillBase):
    id: int
    class Config:
        from_attributes = True

class ResumeBase(BaseModel):
    summary: Optional[str] = None

class ResumeCreate(ResumeBase):
    pass

class Resume(ResumeBase):
    id: int
    candidate_id: Optional[int]
    file_path: str
    structured_data: Dict[str, Any]
    created_at: datetime
    class Config:
        from_attributes = True

class CandidateBase(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None

class CandidateCreate(CandidateBase):
    pass

class Candidate(CandidateBase):
    id: int
    resumes: List[Resume] = []
    class Config:
        from_attributes = True

class ChatMessage(BaseModel):
    message: str
    session_id: str

class ChatResponse(BaseModel):
    response: str

class ChatEditRequest(BaseModel):
    instruction: str

class JobDescriptionCreate(BaseModel):
    title: str
    description: str
    required_skills: List[str]
    company: Optional[str] = None
    seniority: Optional[str] = None
    industry: Optional[str] = None

class JobDescription(JobDescriptionCreate):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True


class MatchRequest(BaseModel):
    resume_id: int
    jd_id: int


class MatchResponse(BaseModel):
    match_id: int
    match_score: float
    matched_skills: List[str]
    missing_skills: List[str]
    semantic_score: float
    recommendation: str


class ResumeVersionResponse(BaseModel):
    version_id: int
    resume_id: int
    jd_id: Optional[int]
    version_no: int
    file_path: Optional[str]
    created_at: datetime


class TailorResumeRequest(BaseModel):
    jd_id: int
    instruction: Optional[str] = None
    template: Optional[str] = "current"


class CandidateSummary(BaseModel):
    resume_id: int
    name: str
    email: str
    top_skills: List[str]
    resume_count: int
    latest_score: float


class AuditLogEntry(BaseModel):
    id: int
    table_name: str
    action: str
    record_pk: Optional[str] = None
    changed_by: str
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    created_at: datetime
