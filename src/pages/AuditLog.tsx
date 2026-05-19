import { motion } from "framer-motion";
import { Shield, Clock } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const logs = [
  { id: 1, action: "INSERT", table: "resume_skills", user: "system", timestamp: "2026-02-18 14:32:01", details: "resume_id=42, skill_id=7 (Python)" },
  { id: 2, action: "INSERT", table: "candidates", user: "admin", timestamp: "2026-02-18 14:31:58", details: "name='Sarah Chen'" },
  { id: 3, action: "UPDATE", table: "resumes", user: "system", timestamp: "2026-02-18 13:15:22", details: "version=2, resume_id=38" },
  { id: 4, action: "INSERT", table: "job_skills", user: "admin", timestamp: "2026-02-18 12:45:10", details: "job_id=3, skill_id=12 (Kubernetes)" },
  { id: 5, action: "DELETE", table: "resume_skills", user: "admin", timestamp: "2026-02-18 11:20:05", details: "resume_id=15, skill_id=3" },
  { id: 6, action: "INSERT", table: "resumes", user: "system", timestamp: "2026-02-18 10:55:33", details: "candidate_id=4, version=1" },
];

const actionColors: Record<string, string> = {
  INSERT: "text-primary",
  UPDATE: "text-yellow-400",
  DELETE: "text-destructive",
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0 },
};

export default function AuditLog() {
  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Database triggers auto-log all INSERT / UPDATE / DELETE operations"
      />

      <div className="max-w-4xl">
        {/* Trigger info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-5 mb-6 glow-border"
        >
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Powered by Database Triggers</p>
              <pre className="text-xs font-mono text-muted-foreground bg-secondary/50 p-3 rounded-lg mt-2 leading-relaxed">
{`CREATE TRIGGER trg_audit_resume
  AFTER INSERT OR UPDATE OR DELETE ON resumes
  FOR EACH ROW
  EXECUTE FUNCTION fn_log_audit();`}
              </pre>
            </div>
          </div>
        </motion.div>

        {/* Log entries */}
        <div className="glass-panel overflow-hidden">
          <div className="grid grid-cols-[80px_120px_140px_1fr] gap-4 px-6 py-3 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            <span>Action</span>
            <span>Table</span>
            <span>Timestamp</span>
            <span>Details</span>
          </div>

          <motion.div variants={container} initial="hidden" animate="show">
            {logs.map((log) => (
              <motion.div
                key={log.id}
                variants={item}
                className="grid grid-cols-[80px_120px_140px_1fr] gap-4 px-6 py-3 items-center border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors"
              >
                <span className={`text-xs font-bold font-mono ${actionColors[log.action]}`}>
                  {log.action}
                </span>
                <span className="text-xs font-mono text-foreground">{log.table}</span>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span className="font-mono">{log.timestamp.split(" ")[1]}</span>
                </div>
                <span className="text-xs text-muted-foreground font-mono truncate">{log.details}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
