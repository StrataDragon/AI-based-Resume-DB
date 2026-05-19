import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Users,
  FileText,
  Briefcase,
  TrendingUp,
  Clock,
  ArrowRight,
  Zap,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { getDashboardStats } from "@/api";

interface DashboardStats {
  total_candidates: number;
  resumes_parsed: number;
  active_jobs: number;
  avg_match_score: number;
  recent_resumes: { name: string; role: string; score: number; time: string }[];
  top_skills: { name: string; count: number; percentage: number }[];
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

const Index = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch dashboard stats", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-muted-foreground">Loading dashboard...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="AI-Assisted Resume Data Management System"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Total Candidates" value={stats?.total_candidates || 0} delay={0} />
        <StatCard icon={FileText} label="Resumes Parsed" value={stats?.resumes_parsed || 0} delay={0.05} />
        <StatCard icon={Briefcase} label="Active Jobs" value={stats?.active_jobs || 0} delay={0.1} />
        <StatCard icon={TrendingUp} label="Avg Match Score" value={`${stats?.avg_match_score || 0}%`} delay={0.15} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Resumes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="lg:col-span-2 glass-panel p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Recently Parsed</h2>
            </div>
          </div>

          <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
            {stats?.recent_resumes && stats.recent_resumes.length > 0 ? (
              stats.recent_resumes.map((resume, i) => (
                <motion.div
                  key={i}
                  variants={item}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/40 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {(resume.name || "U").charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {resume.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{resume.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{resume.score > 0 ? `${resume.score}%` : 'N/A'}</p>
                      <p className="text-[10px] text-muted-foreground">{resume.time}</p>
                    </div>
                  </div>
                </motion.div>
              ))) : (
              <div className="text-muted-foreground text-sm p-4 text-center">No resumes parsed yet.</div>
            )}
          </motion.div>
        </motion.div>

        {/* Top Skills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="glass-panel p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Top Skills</h2>
          </div>

          <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
            {stats?.top_skills.map((skill) => (
              <motion.div key={skill.name} variants={item}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-foreground">{skill.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{skill.count}</span>
                </div>
                <div className="score-bar">
                  <motion.div
                    className="score-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${skill.percentage}%` }}
                    transition={{ duration: 0.7, delay: 0.6 }}
                  />
                </div>
              </motion.div>
            ))}
            {(!stats?.top_skills || stats.top_skills.length === 0) && (
              <div className="text-muted-foreground text-sm text-center">No skills data yet.</div>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* DBMS Highlight */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="mt-6 glass-panel p-6 glow-border"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">DBMS-Centric Architecture</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All matching logic runs as <span className="font-mono text-primary">SQL queries</span> —
              not AI black-box scoring. Normalized to 3NF with full ACID compliance.
              Triggers, Views, and Stored Procedures handle audit trails and gap analysis at the database level.
            </p>
            <div className="flex gap-2 mt-3">
              <span className="tag">3NF Normalized</span>
              <span className="tag">ACID Compliant</span>
              <span className="tag">SQL Triggers</span>
              <span className="tag">Indexed Queries</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Index;
