import { motion } from "framer-motion";
import { Database, Table, Key, ArrowRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const tables = [
  {
    name: "candidates",
    columns: [
      { name: "id", type: "SERIAL", constraint: "PRIMARY KEY" },
      { name: "name", type: "VARCHAR(100)", constraint: "NOT NULL" },
      { name: "email", type: "VARCHAR(255)", constraint: "UNIQUE" },
      { name: "created_at", type: "TIMESTAMP", constraint: "DEFAULT NOW()" },
    ],
  },
  {
    name: "resumes",
    columns: [
      { name: "id", type: "SERIAL", constraint: "PRIMARY KEY" },
      { name: "candidate_id", type: "INT", constraint: "FK → candidates" },
      { name: "version", type: "INT", constraint: "DEFAULT 1" },
      { name: "raw_text", type: "TEXT", constraint: "" },
      { name: "parsed_at", type: "TIMESTAMP", constraint: "" },
    ],
  },
  {
    name: "skills",
    columns: [
      { name: "id", type: "SERIAL", constraint: "PRIMARY KEY" },
      { name: "name", type: "VARCHAR(50)", constraint: "UNIQUE NOT NULL" },
      { name: "category", type: "VARCHAR(30)", constraint: "" },
    ],
  },
  {
    name: "resume_skills",
    columns: [
      { name: "resume_id", type: "INT", constraint: "FK → resumes" },
      { name: "skill_id", type: "INT", constraint: "FK → skills" },
      { name: "proficiency", type: "VARCHAR(20)", constraint: "CHECK" },
    ],
  },
  {
    name: "jobs",
    columns: [
      { name: "id", type: "SERIAL", constraint: "PRIMARY KEY" },
      { name: "title", type: "VARCHAR(100)", constraint: "NOT NULL" },
      { name: "company", type: "VARCHAR(100)", constraint: "" },
      { name: "description", type: "TEXT", constraint: "" },
    ],
  },
  {
    name: "job_skills",
    columns: [
      { name: "job_id", type: "INT", constraint: "FK → jobs" },
      { name: "skill_id", type: "INT", constraint: "FK → skills" },
      { name: "weight", type: "VARCHAR(20)", constraint: "CHECK" },
    ],
  },
  {
    name: "audit_log",
    columns: [
      { name: "id", type: "SERIAL", constraint: "PRIMARY KEY" },
      { name: "table_name", type: "VARCHAR(50)", constraint: "" },
      { name: "action", type: "VARCHAR(10)", constraint: "" },
      { name: "old_data", type: "JSONB", constraint: "" },
      { name: "new_data", type: "JSONB", constraint: "" },
      { name: "changed_at", type: "TIMESTAMP", constraint: "DEFAULT NOW()" },
    ],
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function SchemaView() {
  return (
    <div>
      <PageHeader
        title="Database Schema"
        subtitle="3NF normalized — 7 tables with full referential integrity"
      />

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((table) => (
          <motion.div key={table.name} variants={item} className="glass-panel-hover p-5">
            <div className="flex items-center gap-2 mb-4">
              <Table className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold font-mono text-foreground">{table.name}</h3>
            </div>
            <div className="space-y-1.5">
              {table.columns.map((col) => (
                <div key={col.name} className="flex items-center gap-2 text-xs">
                  {col.constraint.includes("PRIMARY") ? (
                    <Key className="w-3 h-3 text-primary shrink-0" />
                  ) : col.constraint.includes("FK") ? (
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  ) : (
                    <span className="w-3 shrink-0" />
                  )}
                  <span className="font-mono text-foreground">{col.name}</span>
                  <span className="font-mono text-muted-foreground ml-auto">{col.type}</span>
                </div>
              ))}
            </div>
            {table.columns.some((c) => c.constraint.includes("FK")) && (
              <div className="mt-3 pt-3 border-t border-border/50">
                {table.columns
                  .filter((c) => c.constraint.includes("FK"))
                  .map((c) => (
                    <p key={c.name} className="text-[10px] text-muted-foreground font-mono">
                      {c.name} {c.constraint}
                    </p>
                  ))}
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
