import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { getCandidates } from "@/api";

interface CandidateRow {
  resume_id: number;
  name: string;
  email: string;
  top_skills: string[];
  resume_count: number;
  latest_score: number;
}

export default function Candidates() {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<CandidateRow[]>([]);

  const load = async (query = "") => {
    const data = await getCandidates(query);
    setRows(data);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader title="Candidates" subtitle="Search candidates and resume skill profiles" />

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or skill..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input w-full pl-10 pr-4 py-2.5 text-sm"
          />
        </div>
        <button
          className="px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
          onClick={() => load(search)}
        >
          Search
        </button>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="grid grid-cols-[2fr_2fr_3fr_1fr_1fr] gap-4 px-6 py-3 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          <span>Candidate</span>
          <span>Email</span>
          <span>Top Skills</span>
          <span>Score</span>
          <span>Resumes</span>
        </div>

        {rows.map((c) => (
          <div
            key={c.resume_id}
            className="grid grid-cols-[2fr_2fr_3fr_1fr_1fr] gap-4 px-6 py-4 items-center border-b border-border/50 last:border-0"
          >
            <p className="text-sm font-medium text-foreground">{c.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{c.email || "-"}</p>
            <div className="flex flex-wrap gap-1.5">
              {c.top_skills.map((s) => (
                <span key={s} className="tag">
                  {s}
                </span>
              ))}
            </div>
            <span className="text-sm text-foreground">{c.latest_score.toFixed(2)}%</span>
            <span className="text-sm text-muted-foreground">{c.resume_count}</span>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No candidates found.</div>
        )}
      </div>
    </div>
  );
}
