import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Upload,
  Briefcase,
  GitCompare,
  Users,
  Database,
  Shield,
  FileText,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/upload", icon: Upload, label: "Resume Upload" },
  { to: "/jobs", icon: Briefcase, label: "Job Descriptions" },
  { to: "/gap-analysis", icon: GitCompare, label: "Gap Analysis" },
  { to: "/candidates", icon: Users, label: "Candidates" },
  { to: "/preview", icon: FileText, label: "Diff Viewer" },
];

const bottomItems = [
  { to: "/audit", icon: Shield, label: "Audit Log" },
  { to: "/schema", icon: Database, label: "DB Schema" },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="border-b border-sidebar-border p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary/25">
            <Database className="h-5 w-5 text-sidebar-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground">ResumeDB</h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-sidebar-foreground/60">AI + RDBMS</p>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 p-3 space-y-1">
        <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/55">
          Main
        </p>
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <RouterNavLink key={item.to} to={item.to} className="block relative">
              <div className={`nav-link ${isActive ? "active" : ""}`}>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-sidebar-primary/20"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <item.icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{item.label}</span>
              </div>
            </RouterNavLink>
          );
        })}
      </nav>

      {/* Bottom Nav */}
      <div className="space-y-1 border-t border-sidebar-border p-3">
        <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/55">
          System
        </p>
        {bottomItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <RouterNavLink key={item.to} to={item.to} className="block">
              <div className={`nav-link ${isActive ? "active" : ""}`}>
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
            </RouterNavLink>
          );
        })}
      </div>
    </aside>
  );
}
