import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitCompare, FileText, Upload, Eye, FileDown, CheckCircle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ResumeDiffPreview from '@/components/ResumeDiffPreview';
import PdfDiffViewer from '@/components/PdfDiffViewer';

type CompareMode = 'text' | 'pdf';

export default function DiffPreviewer() {
  const [mode, setMode] = useState<CompareMode>('text');
  
  // Plain text compare states
  const [originalContent, setOriginalContent] = useState('');
  const [modifiedContent, setModifiedContent] = useState('');

  // PDF visual compare states
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [modifiedFile, setModifiedFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [modifiedUrl, setModifiedUrl] = useState<string>('');

  // Handle local PDF URLs with cleanup to prevent memory leaks
  useEffect(() => {
    if (originalFile) {
      const url = URL.createObjectURL(originalFile);
      setOriginalUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalUrl('');
    }
  }, [originalFile]);

  useEffect(() => {
    if (modifiedFile) {
      const url = URL.createObjectURL(modifiedFile);
      setModifiedUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setModifiedUrl('');
    }
  }, [modifiedFile]);

  // Sample text data for quick testing
  const loadSampleText = () => {
    setOriginalContent(`John Doe
Software Engineer
Experience:
- Worked at Company A
- Built some features in React
Skills: JavaScript, React`);
    setModifiedContent(`John Doe
Senior Software Engineer
Experience:
- Worked at Company A as a Lead Developer
- Built scalable features in React and TypeScript
- Improved performance by 30%
Skills: JavaScript, TypeScript, React, Node.js`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Document Diff Viewer"
        subtitle="LLM-style diff engine and visual side-by-side comparison for plain-text or rendered PDF resumes."
      />

      {/* Mode Switcher Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <div className="flex rounded-lg p-1 bg-slate-100 border border-slate-200/50">
          <button
            onClick={() => setMode('text')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
              mode === 'text'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Plain Text Engine
          </button>
          <button
            onClick={() => setMode('pdf')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
              mode === 'pdf'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Visual PDF Embedder
          </button>
        </div>

        {mode === 'text' && (
          <button
            onClick={loadSampleText}
            className="text-xs px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 rounded-lg transition font-bold flex items-center gap-2 shadow-sm self-stretch sm:self-auto justify-center"
          >
            <FileText className="w-3.5 h-3.5" />
            Load Sample Text
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {mode === 'text' ? (
          <motion.div
            key="text-compare"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Input panes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                  Original Resume Content
                </h3>
                <textarea
                  className="w-full h-64 p-4 rounded-lg border border-slate-200 bg-slate-50/50 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition leading-relaxed"
                  placeholder="Paste or type original resume text here..."
                  value={originalContent}
                  onChange={(e) => setOriginalContent(e.target.value)}
                />
              </div>

              <div className="glass-panel p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
                  Modified / Tailored Resume Content
                </h3>
                <textarea
                  className="w-full h-64 p-4 rounded-lg border border-slate-200 bg-slate-50/50 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition leading-relaxed"
                  placeholder="Paste or type tailored resume text here..."
                  value={modifiedContent}
                  onChange={(e) => setModifiedContent(e.target.value)}
                />
              </div>
            </div>

            {/* Live Text Diff rendering */}
            {(originalContent || modifiedContent) && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <h2 className="text-sm font-bold flex items-center gap-2 text-slate-800">
                  <GitCompare className="w-4 h-4 text-indigo-600" />
                  Live Line-by-Line Changes
                </h2>
                <ResumeDiffPreview
                  changes={[]}
                  originalContent={originalContent}
                  tailoredContent={modifiedContent}
                />
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="pdf-compare"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Local PDF Dropzones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PdfDropzone
                label="Original Uploaded PDF"
                file={originalFile}
                onFileSelect={setOriginalFile}
                colorClass="border-red-200 hover:border-red-400"
                accentColor="bg-red-500"
              />
              <PdfDropzone
                label="Modified / Tailored PDF"
                file={modifiedFile}
                onFileSelect={setModifiedFile}
                colorClass="border-green-200 hover:border-green-400"
                accentColor="bg-green-500"
              />
            </div>

            {/* Visual side-by-side sync rendering */}
            {originalUrl && modifiedUrl ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <PdfDiffViewer
                  originalPdfUrl={originalUrl}
                  tailoredPdfUrl={modifiedUrl}
                  highlights={[]}
                  fallbackComponent={
                    <div className="p-5 border border-red-200 bg-red-50 rounded-xl text-center text-sm font-semibold text-red-800 shadow-sm">
                      ⚠️ Could not render visual side-by-side. Please verify both files are valid PDF documents.
                    </div>
                  }
                />
              </motion.div>
            ) : (
              <div className="p-10 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center flex flex-col items-center justify-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shadow-sm">
                  👁️
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Visual Diff Viewer Ready</h4>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-[280px] mx-auto leading-relaxed">
                    Upload both your original and modified PDF resume files above to visually compare rendered documents with synchronized scrolling.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Local PDF Dropzone Component ───────────────────────────────────────────
interface PdfDropzoneProps {
  label: string;
  file: File | null;
  onFileSelect: (file: File | null) => void;
  colorClass: string;
  accentColor: string;
}

function PdfDropzone({ label, file, onFileSelect, colorClass, accentColor }: PdfDropzoneProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      if (selected.type === 'application/pdf') {
        onFileSelect(selected);
      } else {
        alert('Please select a valid PDF document.');
      }
    }
  };

  return (
    <div className={`border-2 border-dashed rounded-xl p-5 bg-white text-center transition shadow-sm ${colorClass} relative flex flex-col items-center justify-center min-h-[160px]`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="application/pdf"
        className="hidden"
      />

      {file ? (
        <div className="flex flex-col items-center gap-2.5 w-full">
          <div className="flex items-center gap-2 justify-center w-full px-4">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${accentColor} animate-pulse`} />
            <span className="text-xs font-bold text-slate-800 truncate max-w-[240px]">
              {file.name}
            </span>
          </div>
          
          <div className="text-[10px] text-slate-500 font-semibold bg-slate-100 border border-slate-200/50 px-2 py-0.5 rounded-full">
            {(file.size / 1024).toFixed(1)} KB • PDF Document
          </div>

          <div className="flex gap-2 mt-2 w-full max-w-[220px]">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-1.5 text-[10px] font-bold bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition shadow-sm"
            >
              Replace Document
            </button>
            <button
              onClick={() => onFileSelect(null)}
              className="px-2 py-1.5 text-[10px] font-bold bg-white hover:bg-red-50 border border-slate-200 hover:border-red-100 text-slate-400 hover:text-red-600 rounded-lg transition"
            >
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-3 p-4 group"
        >
          <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200/50 flex items-center justify-center text-slate-400 shadow-sm group-hover:scale-105 transition duration-200">
            <Upload className="w-4 h-4 text-slate-500" />
          </div>
          
          <div>
            <h4 className="text-xs font-bold text-slate-700">{label}</h4>
            <p className="text-[10px] text-slate-400 mt-1">
              Click to select or drag & drop a PDF file
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
