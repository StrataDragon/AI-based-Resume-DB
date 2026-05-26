# Resume Insight Engine 🚀

An AI-powered, DBMS-centric resume parser, management, and strategic optimization suite. The **Resume Insight Engine** helps recruiters and candidates analyze, match, tailor, and audit resumes using local vector retrieval (RAG) and high-accuracy language model processing.

---

## 🛠️ Technology Stack

| Layer | Technology | Key Libraries / Modules |
| :--- | :--- | :--- |
| **Frontend** | React (TypeScript), Vite | Tailwind CSS, Shadcn/UI, Recharts, Framer Motion, Lucide icons, React Router, Axios |
| **Backend** | Python 3.10+, FastAPI | LangChain, LangChain-Groq (`llama-3.3-70b-versatile`), LangChain-HuggingFace (`all-MiniLM-L6-v2`), FAISS Vector Store, PyPDF, python-docx |
| **Database** | PostgreSQL (Primary), SQLite (Fallback) | SQLAlchemy ORM, 3NF Normalization, SQL-level triggers & automatic mapper auditing |

---

## 💎 Key Features

### 📊 1. AI-Driven Resume Parsing & Extraction
* **File Ingestion**: Seamless drag-and-drop processing for both **PDF** and **DOCX** files.
* **Structured Data Generation**: Leverages LLM schema-extraction to divide raw text into highly structured candidate records: contact info, educational history (degree, school, year, CGPA), work experience, projects, links, and detailed skill categories.
* **Vector Indexing (RAG)**: Automatically segments raw text, calculates HuggingFace sentence-transformer embeddings, and writes a local FAISS index for high-speed semantic retrieval.

### 🔬 2. The Innovation Lab (Career DNA)
* **Career DNA Metrics**: Dynamically scores resumes across five strategic axes:
  * **Impact**: Measures quantifiable metrics and percent/dollar-based outcomes.
  * **Momentum**: Detects action verbs and active-voice statements.
  * **Technical Depth**: Maps skill counts and domain category coverage.
  * **Clarity**: Evaluates bullet readability and word-count ratios.
  * **Leadership**: Analyzes evidence of ownership, mentorship, and cross-functional team direction.
* **Signal Flags**: Identifies critical issues such as a narrow skill surface or low quantified impact ratios.
* **Projected Gains (Ghost-Gap Simulation)**: Simulates the direct statistical score improvement candidate resumes would experience by acquiring or integrating missing skills (e.g., `+10% match score if FastAPI is added`).
* **Interactive Next Best Moves**: Interactive, one-click prompts (e.g. *Quantified Bullet Upgrade*, *Signal Leadership*) that rewrite resume descriptions in real time.
* **STAR Story Arcs**: Generates personalized behavioral interview practice prompts from parsed resume bullet points.

### ⚖️ 3. Skill Gap Analysis & ATS Shadowing
* **Hybrid Match Scoring**: Combines SQL-based keyword coverage with advanced embedding-based semantic similarity scoring.
* **ATS Shadow Simulation**: Calculates projected parsing scores for common commercial platforms:
  * **Workday Shadow**: Weights keyword coverage, layout section checks, formatting, and contact availability.
  * **Greenhouse Shadow**: Weights semantic alignment, keyword mapping, impact signal, and section completeness.
  * **Lever Shadow**: Weights keyword presence, semantic overlap, recency indicators, and document readability.
* **Cross-Role Skill Heatmap**: Provides a unified visual comparison of candidate skills across the top six active job descriptions, indicating matched requirements, missing skills, and overall density.

### 💬 4. RAG-Powered Conversational Editor
* **In-Context Chat**: Real-time communication regarding candidate history with answers constrained directly to facts retrieved from the FAISS vector index.
* **Action-Guided Mutator**: Prompts starting with action verbs (e.g. *Rewrite*, *Add*, *Modify*) trigger structured changes.
* **Safety Protocols**: Active system rules enforce strict, truthful adaptations—preventing the hallucination of metrics, employers, dates, or titles.

### 📝 5. Automated Tailoring & Version Control
* **Context-Aware Tailoring**: Generates tailored iterations targeted to a specific job description.
* **Docx Exporter**: Compiles updated structured data back into professional Word Documents using premium visual templates.
* **Version Registry**: Automatically captures and stores every revision in the database, allowing side-by-side comparison of changes (using diff views).

### 🛡️ 6. Automated DB Auditing (DBMS-Centric)
* **SQL Trigger Audit System**: Implements database event listeners via SQLAlchemy that capture mutations (`INSERT`, `UPDATE`, `DELETE`) across all primary tables.
* **Audit Registry**: Records absolute data state diffs (`old_values` vs `new_values`) along with candidate IDs, timestamps, and keys.

---

## 📂 Project Structure

```text
resume-insight-engine/
├── backend/                   # FastAPI Python Server
│   ├── ats_checker/           # File parser & text extractor helpers
│   ├── audit.py               # SQLAlchemy mutation listener & logger
│   ├── database.py            # Primary (PostgreSQL) / Fallback (SQLite) connection
│   ├── logic.py               # Parser, LLM chains, FAISS indexer, Word generator
│   ├── main.py                # REST API endpoints, routing, & seeding
│   ├── models.py              # Relational models in 3NF
│   ├── requirements.txt       # Python dependencies
│   └── schemas.py             # Pydantic validation schemas
├── src/                       # React / TypeScript Frontend
│   ├── api/                   # Axios-based API client methods
│   ├── components/            # Shared components (Sidebar, PageHeader, StatCard...)
│   ├── pages/                 # Full view layouts (GapAnalysis, ResumeUpload...)
│   ├── index.css              # Glassmorphism design tokens & animations
│   ├── main.tsx               # Client entrypoint
│   └── App.tsx                # App routing (React Router)
├── vector_stores/             # Local FAISS databases (Generated dynamically)
├── uploads/                   # Uploaded/tailored resume files (PDF, DOCX)
├── resume_insight.db          # Fallback SQLite Database file
└── startup.bat                # Automated installation & launch utility
```

---

## ⚡ Quick Start

The project includes an automated script (`startup.bat`) that checks for virtual environments, installs backend/frontend dependencies, and starts both application processes.

### Prerequisites
* **Node.js** (v18 or higher)
* **Python 3.10+** (Added to your System Path)
* **Groq API Key**: Set your key in the environment to connect to the Llama-3.3 model.

### Running the Application

1. Create a `.env` file in the root directory:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   DATABASE_URL=sqlite:///./resume_insight.db
   ```
2. Double-click `startup.bat` (or run it via Command Prompt):
   ```cmd
   startup.bat
   ```
3. Open your browser to access the platforms:
   * **Frontend Interface**: [http://localhost:5173](http://localhost:5173)
   * **Backend REST Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🧪 Verification & Testing

Verify that all systems are operational using the built-in integration suites:

* **Backend Integration (Upload & Chat)**:
  ```bash
  .venv\Scripts\python verify_backend.py
  ```
* **RAG Context Verification**:
  ```bash
  .venv\Scripts\python verify_chat.py
  ```
* **Job Matching Engine Validation**:
  ```bash
  .venv\Scripts\python verify_job_match.py
  ```

---

## 🛡️ Database Schema Overview (3NF)

Below are the primary tables backing the system's relational architecture:

1. **`candidates`**: Master entity tracking names, emails, and contact numbers.
2. **`resumes`**: Stores document metadata, raw texts, and deep structured extraction JSONs.
3. **`skills` & `resume_skills`**: Clean many-to-many relationship mapping candidate skill indicators.
4. **`job_descriptions` & `jd_skills`**: Tracks recruitment criteria and required core skills.
5. **`match_results`**: Persists matching metrics, score breakdowns, and specific recommendations.
6. **`resume_versions`**: Records past tailored updates of Word document exports.
7. **`audit_logs`**: Tracks database mutations automatically, retaining deep diffs of modifications.
