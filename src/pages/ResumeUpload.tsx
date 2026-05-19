import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  AlertCircle,
  X,
  Loader2,
  Send,
  Download,
  Briefcase,
  Sparkles,
  MessageSquare,
  FlaskConical,
  Rocket,
  CheckCircle,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { api, uploadResume, downloadResumeWithTemplateUrl, chatWithResume, getInnovationLab } from "@/api";

interface ParsedData {
  name?: string;
  email?: string;
  phone?: string;
  skills?: string[];
  education?: unknown[];
  experience?: unknown[];
  summary?: string;
}

interface JobMatchResult {
  score: number;
  missing_skills: string[];
  recommendation: string;
}

interface InnovationLabData {
  career_dna: {
    impact: number;
    momentum: number;
    technical_depth: number;
    clarity: number;
    leadership: number;
  };
  signal_flags: { label: string; severity: string; detail: string }[];
  ghost_gap_simulation: {
    jd_skills_detected: string[];
    current_keyword_match_score: number;
    top_missing_skills: string[];
    projected_gains: { skill: string; projected_score_if_added: number; delta: number }[];
  };
  next_best_moves: { title: string; instruction: string; estimated_gain: number }[];
  interview_story_arcs: { title: string; prompt: string }[];
  uniqueness_signature: { domain: string; skills: string[] }[];
}

const dnaLabels: { key: keyof InnovationLabData["career_dna"]; title: string }[] = [
  { key: "impact", title: "Impact" },
  { key: "momentum", title: "Momentum" },
  { key: "technical_depth", title: "Depth" },
  { key: "clarity", title: "Clarity" },
  { key: "leadership", title: "Leadership" },
];

export default function ResumeUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "parsed">("idle");
  const [fileName, setFileName] = useState("");
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [downloadTemplate, setDownloadTemplate] = useState<"current" | "index_html">("index_html");

  const [chatMessage, setChatMessage] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "ai"; content: string }[]>([
    {
      role: "ai",
      content: "Resume parsed. Ask for edits or click Innovation Lab for strategy insights.",
    },
  ]);

  const [activeTab, setActiveTab] = useState<"chat" | "match" | "lab">("chat");
  const [jobDescription, setJobDescription] = useState("");
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<JobMatchResult | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  const [labData, setLabData] = useState<InnovationLabData | null>(null);
  const [isLabLoading, setIsLabLoading] = useState(false);
  const [labError, setLabError] = useState<string | null>(null);
  const [applyingMove, setApplyingMove] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }, []);

  const handleUpload = async (file: File) => {
    setFileName(file.name);
    setUploadState("uploading");
    setLabData(null);
    setLabError(null);
    setMatchResult(null);
    setMatchError(null);

    try {
      const response = await uploadResume(file);
      setResumeId(response.id);
      setParsedData(response.data);
      setUploadState("parsed");
      setActiveTab("chat");
    } catch (error) {
      console.error("Upload failed", error);
      setUploadState("idle");
    }
  };

  const handleChat = async () => {
    if (!resumeId || !chatMessage.trim()) return;
    const userMsg = chatMessage.trim();
    setChatHistory((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatMessage("");
    setIsChatting(true);

    const lowerMsg = userMsg.toLowerCase();
    const isEditCommand = ["rewrite", "add", "change", "update", "delete", "remove", "fix", "improve"].some((verb) =>
      lowerMsg.startsWith(verb)
    );

    try {
      if (isEditCommand) {
        const response = await api.post(`/chat/edit/${resumeId}`, { instruction: userMsg });
        setParsedData(response.data.data);
        setChatHistory((prev) => [
          ...prev,
          { role: "ai", content: "Applied. I updated your resume JSON and refreshed the preview." },
        ]);
      } else {
        const response = await chatWithResume(resumeId, userMsg, chatHistory);
        setChatHistory((prev) => [...prev, { role: "ai", content: response.reply }]);
      }
    } catch (error) {
      console.error("Chat failed", error);
      setChatHistory((prev) => [...prev, { role: "ai", content: "Request failed. Try again." }]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleJobMatch = async () => {
    if (!resumeId || !jobDescription.trim()) return;
    setIsMatching(true);
    setMatchError(null);
    try {
      const response = await api.post(`/analyze/job-match`, { resume_id: resumeId, job_description: jobDescription });
      setMatchResult(response.data);
    } catch (error) {
      console.error("Match failed", error);
      setMatchError("Failed to analyze job match. Please try again.");
      setMatchResult(null);
    } finally {
      setIsMatching(false);
    }
  };

  const runInnovationLab = useCallback(async () => {
    if (!resumeId) return;
    setIsLabLoading(true);
    setLabError(null);
    try {
      const data = await getInnovationLab(resumeId, jobDescription.trim());
      setLabData(data);
    } catch (error) {
      console.error("Innovation lab failed", error);
      setLabError("Failed to generate Innovation Lab insights. Please try again.");
    } finally {
      setIsLabLoading(false);
    }
  }, [resumeId, jobDescription]);

  useEffect(() => {
    if (activeTab === "lab" && resumeId && !labData && !isLabLoading) {
      runInnovationLab();
    }
  }, [activeTab, resumeId, labData, isLabLoading, runInnovationLab]);

  const applyMove = async (instruction: string) => {
    if (!resumeId || !instruction) return;
    setApplyingMove(instruction);
    try {
      const response = await api.post(`/chat/edit/${resumeId}`, { instruction });
      setParsedData(response.data.data);
      setChatHistory((prev) => [
        ...prev,
        { role: "user", content: instruction },
        { role: "ai", content: "Applied this move and updated your resume." },
      ]);
      setActiveTab("chat");
    } catch (error) {
      console.error("Move application failed", error);
    } finally {
      setApplyingMove(null);
    }
  };

  const reset = () => {
    setUploadState("idle");
    setFileName("");
    setResumeId(null);
    setParsedData(null);
    setChatHistory([{ role: "ai", content: "Resume parsed. Ask for edits or click Innovation Lab for strategy insights." }]);
    setMatchResult(null);
    setMatchError(null);
    setJobDescription("");
    setLabData(null);
    setLabError(null);
    setIsLabLoading(false);
    setApplyingMove(null);
    setActiveTab("chat");
  };

  return (
    <div className="relative min-h-screen overflow-hidden p-4 md:p-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-12%] top-[-10%] h-72 w-72 rounded-full bg-cyan-300/40 blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-[-10%] right-[-8%] h-72 w-72 rounded-full bg-orange-300/40 blur-3xl animate-pulse-glow" />
      </div>

      <PageHeader title="Resume Insight Engine" subtitle="Modern AI resume optimization with actionable strategy layers" />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.04fr_1fr]">
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {uploadState === "idle" && (
              <motion.label
                key="dropzone"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`glass-panel flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-8 py-24 transition-all duration-300 ${
                  isDragging ? "border-cyan-500 bg-cyan-50/90" : "border-slate-300/80 hover:border-cyan-500/70 hover:bg-white"
                }`}
              >
                <input type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={handleFileSelect} />
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-white shadow-lg shadow-cyan-500/25">
                  <Upload className="h-10 w-10" />
                </div>
                <h3 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">Drop resume here</h3>
                <p className="max-w-sm text-center text-sm text-slate-600">
                  Upload PDF or DOCX to extract structure, run ATS scoring, and generate strategic improvement moves.
                </p>
              </motion.label>
            )}
            {uploadState === "uploading" && (
              <motion.div
                key="uploading"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="glass-panel flex min-h-[380px] flex-col items-center justify-center p-12"
              >
                <div className="relative">
                  <div className="h-24 w-24 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-500" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FileText className="h-8 w-8 text-cyan-600" />
                  </div>
                </div>
                <p className="mt-6 text-lg font-semibold text-slate-900">Analyzing {fileName}...</p>
                <p className="mt-2 text-sm text-slate-600">Extracting skills, signals, and narrative quality.</p>
              </motion.div>
            )}

            {uploadState === "parsed" && parsedData && (
              <motion.div key="parsed" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <div className="glass-panel relative overflow-hidden p-6">
                  <button
                    onClick={reset}
                    className="absolute right-4 top-4 rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="mb-6 flex items-start gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-600 to-emerald-500 text-2xl font-bold text-white">
                      {(parsedData.name || "U").charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-slate-900">{parsedData.name || "Unknown Candidate"}</h2>
                      <p className="text-sm font-medium text-cyan-700">{parsedData.email || "No email detected"}</p>
                      <p className="text-xs text-slate-500">{parsedData.phone || "No phone detected"}</p>
                    </div>
                  </div>

                  <div className="mb-5 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-cyan-100 bg-cyan-50/80 p-3">
                      <p className="text-[11px] uppercase tracking-wider text-cyan-700">Skills</p>
                      <p className="text-xl font-bold text-slate-900">{parsedData.skills?.length || 0}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-3">
                      <p className="text-[11px] uppercase tracking-wider text-emerald-700">Experience</p>
                      <p className="text-xl font-bold text-slate-900">{parsedData.experience?.length || 0}</p>
                    </div>
                    <div className="rounded-xl border border-orange-100 bg-orange-50/80 p-3">
                      <p className="text-[11px] uppercase tracking-wider text-orange-700">Education</p>
                      <p className="text-xl font-bold text-slate-900">{parsedData.education?.length || 0}</p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Summary</h4>
                      <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                        {parsedData.summary || "No summary available."}
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {parsedData.skills?.length ? (
                          parsedData.skills.map((skill, i) => (
                            <span
                              key={`${skill}-${i}`}
                              className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800"
                            >
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">No skills extracted yet.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3 border-t border-slate-200 pt-5">
                    <select
                      value={downloadTemplate}
                      onChange={(e) => setDownloadTemplate(e.target.value as "current" | "index_html")}
                      className="glass-input max-w-[220px] px-3 py-2 text-sm"
                    >
                      <option value="current">Current Template</option>
                      <option value="index_html">Index HTML Template</option>
                    </select>
                    <a
                      href={resumeId ? downloadResumeWithTemplateUrl(resumeId, downloadTemplate) : "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="shiny-button flex flex-1 items-center justify-center gap-2"
                    >
                      <Download className="h-4 w-4" /> Download DOCX
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {uploadState === "parsed" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="flex h-full flex-col">
            <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white/90 p-1.5">
              <button
                onClick={() => setActiveTab("chat")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
                  activeTab === "chat" ? "bg-cyan-600 text-white shadow-md shadow-cyan-500/25" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <MessageSquare className="h-4 w-4" /> Editor
              </button>
              <button
                onClick={() => setActiveTab("match")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
                  activeTab === "match" ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/25" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Briefcase className="h-4 w-4" /> ATS Match
              </button>
              <button
                onClick={() => setActiveTab("lab")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
                  activeTab === "lab" ? "bg-orange-500 text-white shadow-md shadow-orange-400/25" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <FlaskConical className="h-4 w-4" /> Innovation Lab
              </button>
            </div>

            <div className="glass-panel flex min-h-[680px] flex-1 flex-col overflow-hidden">
              {activeTab === "chat" && (
                <>
                  <div className="flex items-center gap-2 border-b border-slate-200 bg-cyan-50/70 px-5 py-4">
                    <Sparkles className="h-4 w-4 text-cyan-700" />
                    <h3 className="text-sm font-semibold text-slate-900">AI Resume Editor</h3>
                  </div>
                  <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                            msg.role === "user"
                              ? "rounded-tr-sm bg-cyan-600 text-white"
                              : "rounded-tl-sm border border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder="Try: Rewrite summary for product roles"
                        className="glass-input flex-1"
                        onKeyDown={(e) => e.key === "Enter" && handleChat()}
                        disabled={isChatting}
                      />
                      <button
                        onClick={handleChat}
                        disabled={isChatting || !chatMessage.trim()}
                        className="rounded-xl bg-cyan-600 p-2.5 text-white transition hover:bg-cyan-700 disabled:opacity-50"
                      >
                        {isChatting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
              {activeTab === "match" && (
                <div className="flex h-full flex-col">
                  <div className="flex items-center gap-2 border-b border-slate-200 bg-emerald-50/70 px-5 py-4">
                    <Briefcase className="h-4 w-4 text-emerald-700" />
                    <h3 className="text-sm font-semibold text-slate-900">ATS Match Simulation</h3>
                  </div>
                  <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-5">
                    {!matchResult ? (
                      <>
                        <textarea
                          value={jobDescription}
                          onChange={(e) => setJobDescription(e.target.value)}
                          placeholder="Paste job description..."
                          className="glass-input h-44 w-full resize-none"
                        />
                        <button
                          onClick={handleJobMatch}
                          disabled={isMatching || !jobDescription.trim()}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {isMatching ? <Loader2 className="h-5 w-5 animate-spin" /> : "Analyze ATS Match"}
                        </button>
                        {matchError && (
                          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            {matchError}
                          </div>
                        )}
                      </>
                    ) : (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50 p-5">
                          <p className="text-xs uppercase tracking-wider text-emerald-700">Match Score</p>
                          <p className="glow-text mt-1 text-4xl font-bold text-slate-900">{matchResult.score}%</p>
                          <div className="score-bar mt-4">
                            <div className="score-bar-fill" style={{ width: `${Math.max(2, Math.min(matchResult.score, 100))}%` }} />
                          </div>
                        </div>

                        <div>
                          <h4 className="mb-2 text-sm font-semibold text-slate-800">Missing Skills</h4>
                          <div className="flex flex-wrap gap-2">
                            {matchResult.missing_skills.length ? (
                              matchResult.missing_skills.map((skill, i) => (
                                <span key={`${skill}-${i}`} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                                  {skill}
                                </span>
                              ))
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                                <CheckCircle className="h-3.5 w-3.5" /> No major gaps detected
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                          <h4 className="mb-1 text-sm font-semibold text-cyan-900">Recommendation</h4>
                          <p className="text-sm text-slate-700">{matchResult.recommendation}</p>
                        </div>

                        <button onClick={() => setMatchResult(null)} className="glass-button w-full">
                          Analyze Another Job
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "lab" && (
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-orange-50/70 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Rocket className="h-4 w-4 text-orange-700" />
                      <h3 className="text-sm font-semibold text-slate-900">Innovation Lab</h3>
                    </div>
                    <button onClick={runInnovationLab} disabled={isLabLoading} className="glass-button px-3 py-1.5 text-xs">
                      {isLabLoading ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>

                  <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-5">
                    {isLabLoading && (
                      <div className="flex min-h-[280px] items-center justify-center">
                        <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
                      </div>
                    )}

                    {!isLabLoading && labError && (
                      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        {labError}
                      </div>
                    )}

                    {!isLabLoading && !labError && !labData && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        No innovation insights yet. Click refresh to generate.
                      </div>
                    )}

                    {!isLabLoading && labData && (
                      <>
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                          {dnaLabels.map(({ key, title }) => {
                            const value = labData.career_dna[key] || 0;
                            return (
                              <div key={key} className="rounded-2xl border border-slate-200 bg-white p-3">
                                <p className="text-[11px] uppercase tracking-widest text-slate-500">{title}</p>
                                <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
                                <div className="score-bar mt-2">
                                  <div className="score-bar-fill" style={{ width: `${Math.max(3, Math.min(value, 100))}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <h4 className="mb-3 text-sm font-semibold text-slate-900">Signal Flags</h4>
                          <div className="space-y-2">
                            {labData.signal_flags.length ? (
                              labData.signal_flags.map((flag, i) => (
                                <div key={`${flag.label}-${i}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <p className="text-sm font-semibold text-slate-800">{flag.label}</p>
                                  <p className="mt-1 text-xs text-slate-600">{flag.detail}</p>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-600">No critical signal issues detected.</p>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <h4 className="mb-3 text-sm font-semibold text-slate-900">Ghost-Gap Simulation</h4>
                          <div className="mb-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                            <p className="text-xs uppercase tracking-wider text-cyan-700">Keyword Match Score</p>
                            <p className="text-2xl font-bold text-slate-900">{labData.ghost_gap_simulation.current_keyword_match_score}%</p>
                          </div>

                          <div className="mb-3">
                            <p className="mb-1 text-xs uppercase tracking-widest text-slate-500">Top Missing Skills</p>
                            <div className="flex flex-wrap gap-2">
                              {labData.ghost_gap_simulation.top_missing_skills.length ? (
                                labData.ghost_gap_simulation.top_missing_skills.map((skill, i) => (
                                  <span key={`${skill}-${i}`} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                                    {skill}
                                  </span>
                                ))
                              ) : (
                                <span className="text-sm text-slate-600">No major missing skills detected.</span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            {labData.ghost_gap_simulation.projected_gains.map((gain, i) => (
                              <div key={`${gain.skill}-${i}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <span className="text-sm font-medium text-slate-800">{gain.skill}</span>
                                <span className="text-xs text-slate-600">+{gain.delta}% to {gain.projected_score_if_added}%</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <h4 className="mb-3 text-sm font-semibold text-slate-900">Next Best Moves</h4>
                          <div className="space-y-2">
                            {labData.next_best_moves.map((move, i) => (
                              <div key={`${move.title}-${i}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{move.title}</p>
                                    <p className="mt-1 text-xs text-slate-600">{move.instruction}</p>
                                    <p className="mt-1 text-xs font-medium text-emerald-700">Estimated gain: +{move.estimated_gain}</p>
                                  </div>
                                  <button
                                    onClick={() => applyMove(move.instruction)}
                                    disabled={Boolean(applyingMove)}
                                    className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-50"
                                  >
                                    {applyingMove === move.instruction ? "Applying..." : "Apply"}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <h4 className="mb-2 text-sm font-semibold text-slate-900">Interview Story Arcs</h4>
                            <div className="space-y-2">
                              {labData.interview_story_arcs.map((arc, i) => (
                                <div key={`${arc.title}-${i}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                  <p className="text-sm font-semibold text-slate-800">{arc.title}</p>
                                  <p className="mt-1 text-xs text-slate-600">{arc.prompt}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <h4 className="mb-2 text-sm font-semibold text-slate-900">Uniqueness Signature</h4>
                            <div className="space-y-2">
                              {labData.uniqueness_signature.length ? (
                                labData.uniqueness_signature.map((sig, i) => (
                                  <div key={`${sig.domain}-${i}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-xs uppercase tracking-wider text-slate-500">{sig.domain}</p>
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                      {sig.skills.map((skill, j) => (
                                        <span key={`${skill}-${j}`} className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-700">
                                          {skill}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-slate-600">Signature not strong yet. Add project-specific tooling and outcomes.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
