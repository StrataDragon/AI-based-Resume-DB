import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { createJobDescription, getJobDescriptions } from "@/api";

interface JobItem {
  jd_id: number;
  title: string;
  company?: string;
  seniority?: string;
  industry?: string;
  description: string;
  required_skills: string[];
  skill_count: number;
}

export default function JobDescriptions() {
  const [items, setItems] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [skills, setSkills] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getJobDescriptions();
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!title.trim() || !description.trim()) return;
    const requiredSkills = skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    await createJobDescription({
      title: title.trim(),
      company: company.trim() || undefined,
      description: description.trim(),
      required_skills: requiredSkills,
    });

    setTitle("");
    setCompany("");
    setSkills("");
    setDescription("");
    await load();
  };

  return (
    <div>
      <PageHeader
        title="Job Descriptions"
        subtitle="Knowledge bank backed by SQL tables and skill metadata"
      />

      <div className="glass-panel p-4 mb-6 grid md:grid-cols-2 gap-3">
        <input
          className="glass-input px-3 py-2 text-sm"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="glass-input px-3 py-2 text-sm"
          placeholder="Company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <input
          className="glass-input px-3 py-2 text-sm md:col-span-2"
          placeholder="Required skills (comma separated)"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
        />
        <textarea
          className="glass-input px-3 py-2 text-sm md:col-span-2 h-28 resize-none"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors md:col-span-2"
          onClick={handleCreate}
        >
          <Plus className="w-4 h-4" /> Add JD
        </button>
      </div>

      <div className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {items.map((job) => (
          <motion.div key={job.jd_id} className="glass-panel-hover p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">{job.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {job.company || "Unknown company"} | {job.skill_count} skills
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {job.required_skills.map((skill) => (
                    <span key={skill} className="tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
