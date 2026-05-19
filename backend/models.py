from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
try:
    from .database import Base
except ImportError:
    from database import Base

class Candidate(Base):
    __tablename__ = "candidates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    resumes = relationship("Resume", back_populates="candidate")

class Resume(Base):
    __tablename__ = "resumes"
    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"))
    file_path = Column(String)
    raw_text = Column(Text)
    structured_data = Column(JSON) # Extracted JSON data
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    candidate = relationship("Candidate", back_populates="resumes")
    skills = relationship("ResumeSkill", back_populates="resume")
    versions = relationship("ResumeVersion", back_populates="resume")
    match_results = relationship("MatchResult", back_populates="resume")

class Skill(Base):
    __tablename__ = "skills"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    category = Column(String, nullable=True) # e.g., "Language", "Framework"

    resumes = relationship("ResumeSkill", back_populates="skill")

class ResumeSkill(Base):
    __tablename__ = "resume_skills"
    resume_id = Column(Integer, ForeignKey("resumes.id"), primary_key=True)
    skill_id = Column(Integer, ForeignKey("skills.id"), primary_key=True)
    
    resume = relationship("Resume", back_populates="skills")
    skill = relationship("Skill", back_populates="resumes")

class JobDescription(Base):
    __tablename__ = "job_descriptions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    company = Column(String, nullable=True)
    seniority = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    description = Column(Text)
    required_skills = Column(JSON) # List of required skills
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    skills = relationship("JDSkill", back_populates="job_description", cascade="all, delete-orphan")
    match_results = relationship("MatchResult", back_populates="job_description")
    resume_versions = relationship("ResumeVersion", back_populates="job_description")


class JDSkill(Base):
    __tablename__ = "jd_skills"
    id = Column(Integer, primary_key=True, index=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), index=True)
    skill_name = Column(String(150), index=True, nullable=False)
    is_required = Column(Boolean, default=True, nullable=False)

    job_description = relationship("JobDescription", back_populates="skills")


class MatchResult(Base):
    __tablename__ = "match_results"
    id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), index=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id"), index=True)
    match_score = Column(Numeric(5, 2), nullable=False)
    matched_skills = Column(JSON, nullable=False)
    missing_skills = Column(JSON, nullable=False)
    semantic_score = Column(Numeric(5, 4), nullable=False, default=0.0)
    recommendation = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    resume = relationship("Resume", back_populates="match_results")
    job_description = relationship("JobDescription", back_populates="match_results")


class ResumeVersion(Base):
    __tablename__ = "resume_versions"
    id = Column(Integer, primary_key=True, index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), index=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id"), nullable=True, index=True)
    version_no = Column(Integer, nullable=False)
    content_text = Column(Text, nullable=False)
    file_path = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    resume = relationship("Resume", back_populates="versions")
    job_description = relationship("JobDescription", back_populates="resume_versions")

class ChatMessageHistory(Base):
    __tablename__ = "chat_message_history"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    message_type = Column(String) # "human" or "ai"
    content = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    table_name = Column(String(80), index=True, nullable=False)
    action = Column(String(16), index=True, nullable=False)  # INSERT / UPDATE / DELETE
    record_pk = Column(String(200), nullable=True)
    changed_by = Column(String(80), nullable=False, default="system")
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
