import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import ResumeUpload from "./pages/ResumeUpload";
import JobDescriptions from "./pages/JobDescriptions";
import GapAnalysis from "./pages/GapAnalysis";
import Candidates from "./pages/Candidates";
import AuditLog from "./pages/AuditLog";
import SchemaView from "./pages/SchemaView";
import DiffPreviewer from "./pages/DiffPreviewer";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/upload" element={<ResumeUpload />} />
            <Route path="/jobs" element={<JobDescriptions />} />
            <Route path="/gap-analysis" element={<GapAnalysis />} />
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/schema" element={<SchemaView />} />
            <Route path="/preview" element={<DiffPreviewer />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
