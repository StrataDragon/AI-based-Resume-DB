export interface TailoringOptions {
  customInstructions?: string;
  template?: 'current' | 'index_html';
  targetSections?: ('summary' | 'experience' | 'skills' | 'education')[];
  keepFormatting?: boolean;
  maxChangesPercent?: number;
  focusAreas?: string[];
}

export interface TailoredResumeResult {
  tailorId: string;
  originalResume: ResumeContent;
  tailoredResume: ResumeContent;
  docxUrl: string;
  changes: Change[];
  metadata: {
    processingTimeMs: number;
    matchScoreBefore: number;
    matchScoreAfter: number;
    improvementPercent: number;
    template: 'current' | 'index_html';
  };
}

export interface Change {
  id: string;
  type: 'added' | 'removed' | 'modified';
  section: string;
  original: string;
  tailored: string;
  startLine: number;
  endLine: number;
  relevanceToJD: number;
  confidence: number;
}

export interface TailoredVersion {
  id: string;
  resumeId: string;
  targetJobId: string;
  targetJobTitle: string;
  tailorId: string;
  createdAt: number;
  matchScore: number;
  changeCount: number;
  docxUrl: string;
  customInstructions?: string;
}

export interface TailoringStatus {
  tailorId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  stage: 'analyzing' | 'tailoring' | 'generating_docx' | 'finalizing';
  error?: { code: string; message: string };
  estimatedTimeRemaining?: number;
}

export interface ResumeContent {
  content: string;
  sections: {
    summary?: string;
    experience?: string[];
    skills?: string[];
    education?: string[];
  };
}

export interface TailoringRequest {
  id: string;
  resumeId: string;
  jdId: string;
  options: TailoringOptions;
  timestamp: number;
  retryCount: number;
}

export interface HighlightRegion {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'added' | 'removed' | 'modified';
  section: string;
  changeId: string;
  confidence: 'approximate';
}

