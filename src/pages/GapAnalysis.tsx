import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, GitCompare, Radar, ShieldCheck } from "lucide-react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar as ReRadar, RadarChart, ResponsiveContainer } from "recharts";
import PageHeader from "@/components/PageHeader";
import { getCandidates, getJobDescriptions, getMatchInsights } from "@/api";
import AutoTailorSection from './GapAnalysis/AutoTailorSection';

interface CandidateItem {
  resume_id: number;
  name: string;
}

interface JobItem {
  jd_id: number;
  title: string;
}

interface MatchResult {
  match_id: number;
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  semantic_score: number;
  recommendation: string;
}

interface RadarPoint {
  axis: string;
  resume: number;
  target: number;
}

interface ATSShadowScore {
  system: string;
  score: number;
  top_signals: string[];
}

interface HeatmapCell {
  skill: string;
  jd_id: number;
  required: boolean;
  matched: boolean;
  intensity: number;
}

interface HeatmapData {
  jobs: { jd_id: number; title: string }[];
  skills: string[];
  cells: HeatmapCell[];
}

interface MatchInsights {
  match: MatchResult;
  radar: RadarPoint[];
  ats_shadow: ATSShadowScore[];
  heatmap: HeatmapData;
}

export default function GapAnalysis() {
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [selectedJdId, setSelectedJdId] = useState<number | null>(null);
  const [insights, setInsights] = useState<MatchInsights | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [candidateData, jobData] = await Promise.all([getCandidates(), getJobDescriptions()]);
      setCandidates(candidateData);
      setJobs(jobData);
      if (candidateData.length) setSelectedResumeId(candidateData[0].resume_id);
      if (jobData.length) setSelectedJdId(jobData[0].jd_id);
    };
    load();
  }, []);

  const runMatch = async () => {
    if (!selectedResumeId || !selectedJdId) return;
    setLoading(true);
    try {
      const data = await getMatchInsights(selectedResumeId, selectedJdId);
      setInsights(data);
    } finally {
      setLoading(false);
    }
  };

  const heatmapMatrix = useMemo(() => {
    if (!insights?.heatmap) return {};
    const map: Record<string, Record<number, HeatmapCell>> = {};
    for (const skill of insights.heatmap.skills) {
      map[skill] = {};
    }
    for (const cell of insights.heatmap.cells) {
      if (!map[cell.skill]) map[cell.skill] = {};
      map[cell.skill][cell.jd_id] = cell;
    }
    return map;
  }, [insights]);

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-700";
    if (score >= 60) return "text-amber-700";
    return "text-rose-700";
  };

  return (
    <div>
      <PageHeader
        title="Skill Gap Analysis"
        subtitle="Advanced matching with ATS shadow simulation and cross-role skill heatmap"
      />

      <div className="max-w-7xl space-y-4">
        <div className="glass-panel p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select
              className="glass-input px-4 py-2.5 text-sm"
              value={selectedResumeId ?? ""}
              onChange={(e) => setSelectedResumeId(Number(e.target.value))}
            >
              {candidates.map((c) => (
                <option key={c.resume_id} value={c.resume_id}>
                  {c.name} (Resume #{c.resume_id})
                </option>
              ))}
            </select>
            <select
              className="glass-input px-4 py-2.5 text-sm"
              value={selectedJdId ?? ""}
              onChange={(e) => setSelectedJdId(Number(e.target.value))}
            >
              {jobs.map((j) => (
                <option key={j.jd_id} value={j.jd_id}>
                  {j.title}
                </option>
              ))}
            </select>
            <button
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              onClick={runMatch}
              disabled={loading || !selectedResumeId || !selectedJdId}
            >
              {loading ? "Running..." : "Run Advanced Match"}
            </button>
          </div>
        </div>

        {insights && (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="glass-panel p-5 lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <GitCompare className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Resume vs JD</p>
                      <p className="text-xs text-muted-foreground">Match ID: {insights.match.match_id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-4xl font-bold ${scoreColor(insights.match.match_score)}`}>{insights.match.match_score}%</p>
                    <p className="text-[11px] text-muted-foreground">Semantic {insights.match.semantic_score.toFixed(3)}</p>
                  </div>
                </div>
                <div className="score-bar">
                  <div className="score-bar-fill" style={{ width: `${Math.max(2, insights.match.match_score)}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Matched Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {insights.match.matched_skills.map((s) => (
                        <span key={s} className="tag">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Missing Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {insights.match.missing_skills.map((s) => (
                        <span key={s} className="tag-missing">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-panel p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Recommendation</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{insights.match.recommendation}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="glass-panel p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Radar className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Skill Match Radar</h3>
                </div>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={insights.radar}>
                      <PolarGrid stroke="rgba(148, 163, 184, 0.45)" />
                      <PolarAngleAxis dataKey="axis" tick={{ fill: "#475569", fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} />
                      <ReRadar name="Target" dataKey="target" stroke="#94a3b8" fill="#e2e8f0" fillOpacity={0.2} />
                      <ReRadar name="Resume" dataKey="resume" stroke="#0891b2" fill="#06b6d4" fillOpacity={0.35} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-panel p-5">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">ATS Shadow Scoring</h3>
                </div>
                <div className="space-y-3">
                  {insights.ats_shadow.map((row) => (
                    <div key={row.system} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">{row.system}</p>
                        <span className={`text-sm font-bold ${scoreColor(row.score)}`}>{row.score}%</span>
                      </div>
                      <div className="score-bar mb-2">
                        <div className="score-bar-fill" style={{ width: `${Math.max(2, row.score)}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {row.top_signals.map((signal) => (
                          <span key={signal} className="tag">
                            {signal}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-panel p-5">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Skill Gap Heatmap</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Darker cells mean stronger alignment. Low-value required cells indicate high-priority gaps.
              </p>

              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-600">Skill</th>
                      {insights.heatmap.jobs.map((job) => (
                        <th key={job.jd_id} className="border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                          {job.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {insights.heatmap.skills.map((skill) => (
                      <tr key={skill}>
                        <td className="border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">{skill}</td>
                        {insights.heatmap.jobs.map((job) => {
                          const cell = heatmapMatrix[skill]?.[job.jd_id];
                          const intensity = cell?.intensity ?? 0;
                          return (
                            <td key={`${skill}-${job.jd_id}`} className="border border-slate-200 p-0">
                              <div
                                className="h-9 w-full"
                                style={{
                                  background: `rgba(6, 182, 212, ${Math.max(0.08, intensity / 120)})`,
                                }}
                                title={`${job.title}: ${cell?.matched ? "Matched required skill" : cell?.required ? "Required but missing" : "Not required"}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4">
              <AutoTailorSection
                resumeId={selectedResumeId.toString()}
                jdId={selectedJdId.toString()}
                onComplete={(result) => {
                  console.log('Tailoring complete:', result);
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
