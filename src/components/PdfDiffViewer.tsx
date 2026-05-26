import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { HighlightRegion, Change } from '@/types/tailoring';

interface PdfDiffViewerProps {
  resumeId: number;
  tailorId: string;
  changes: Change[];
  activeChangeId?: string;
  onChangeIdChange?: (id: string) => void;
}

interface ScrollRef {
  syncScroll: (scrollTop: number) => void;
}

// ─── Single PDF Render Pane ──────────────────────────────────────────────────
interface PdfPaneProps {
  url: string;
  label: string;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  setNumPages: React.Dispatch<React.SetStateAction<number>>;
  numPages: number;
  highlights: HighlightRegion[];
  highlightColor: string;
  borderColor: string;
  activeChangeId?: string;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

const PdfPane = forwardRef<ScrollRef, PdfPaneProps>(({
  url,
  label,
  page,
  setPage,
  setNumPages,
  numPages,
  highlights,
  highlightColor,
  borderColor,
  activeChangeId,
  onScroll,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfPage, setPdfPage] = useState<any>(null);
  
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Sync scroll implementation
  useImperativeHandle(ref, () => ({
    syncScroll: (scrollTop: number) => {
      if (containerRef.current) {
        containerRef.current.scrollTop = scrollTop;
      }
    }
  }));

  // Effect 1: Fetch and load the PDF document object
  useEffect(() => {
    let active = true;
    setLoadError(null);
    setLoadProgress(null);
    setPdfDoc(null);

    const loadPdfDoc = async () => {
      try {
        // Fix 3: Probe the URL first to verify it returns a valid PDF
        try {
          const probe = await fetch(url, { method: 'HEAD' });
          const contentType = probe.headers.get('content-type') ?? '';
          if (!probe.ok || !contentType.toLowerCase().includes('pdf')) {
            throw new Error(`URL returned status ${probe.status} (${contentType})`);
          }
        } catch (err: any) {
          throw new Error(`Cannot reach PDF endpoint: ${err.message}`);
        }

        // Dynamic Import of PDF.js to avoid top-level pre-bundling issues
        const pdfjs = await import('pdfjs-dist');
        const pdfjsLib = (pdfjs as any).GlobalWorkerOptions ? pdfjs : (pdfjs as any).default || pdfjs;

        // Fix 1: Dynamically assign worker src based on actual loaded library version
        pdfjsLib.GlobalWorkerOptions.workerSrc = 
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const loadingTask = pdfjsLib.getDocument({
          url,
          withCredentials: true,
        });

        loadingTask.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
          if (active) {
            setLoadProgress(total > 0 ? Math.round((loaded / total) * 100) : null);
          }
        };

        const pdf = await loadingTask.promise;
        if (!active) return;

        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
      } catch (err: any) {
        console.error('PDF Document Loading failed:', err);
        if (active) {
          setLoadError(err.message || String(err));
        }
      }
    };

    loadPdfDoc();

    return () => {
      active = false;
    };
  }, [url, setNumPages]);

  // Effect 2: Render PDF Page to Canvas dynamically when page or pdfDoc changes
  // Fix 2: Separated effect logic with cancelled token checking & resize container observer
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;

    const render = async () => {
      setRenderError(null);
      setIsRendering(true);

      try {
        const pageDoc = await pdfDoc.getPage(page);
        if (cancelled) return;
        setPdfPage(pageDoc);

        const container = canvasRef.current!.parentElement!;
        // Fix 6: Auto-measure parent container width dynamically
        const containerWidth = container.clientWidth || 580;

        const unscaledViewport = pageDoc.getViewport({ scale: 1 });
        const scale = containerWidth / unscaledViewport.width;
        const viewport = pageDoc.getViewport({ scale });

        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (cancelled) return;

        await pageDoc.render({ canvasContext: context, viewport }).promise;

        if (!cancelled) {
          setIsRendering(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('PDF Page render failed:', err);
          setRenderError(err.message || String(err));
          setIsRendering(false);
        }
      }
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, page]);

  // Effect 3: ResizeObserver to re-render page on container size changes
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;

    let timeoutId: any;
    const observer = new ResizeObserver(() => {
      // Debounce slightly to prevent thrashing
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Trigger a re-render by resetting state slightly or forcing render loop
        setPdfDoc(current => current ? Object.assign(Object.create(Object.getPrototypeOf(current)), current) : null);
      }, 100);
    });

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [pdfDoc]);

  // Coordinates mapping from raw PDF pts to styled Canvas px
  const scaleX = pdfPage && canvasRef.current ? canvasRef.current.width / pdfPage.view[2] : 1;
  const scaleY = pdfPage && canvasRef.current ? canvasRef.current.height / pdfPage.view[3] : 1;

  const pageHighlights = highlights.filter(h => h.page === page);

  const errorState = loadError || renderError;

  return (
    <div className="flex flex-col border border-slate-200 bg-slate-50 rounded-lg overflow-hidden h-[600px] relative">
      {/* Pane Page Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 text-xs shadow-sm z-10">
        <span className="font-bold text-slate-700">{label}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1 hover:bg-slate-100 rounded disabled:opacity-40 font-semibold"
          >
            ◀
          </button>
          <span className="text-slate-600 font-medium">Page {page} of {numPages || 1}</span>
          <button
            onClick={() => setPage(p => Math.min(numPages, p + 1))}
            disabled={page === numPages || numPages === 0}
            className="p-1 hover:bg-slate-100 rounded disabled:opacity-40 font-semibold"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Canvas Viewport Scroller */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex-1 overflow-auto p-4 custom-scrollbar relative flex justify-center bg-slate-100"
      >
        <div className="relative shadow-md rounded-md overflow-hidden bg-white max-w-max h-max">
          <canvas ref={canvasRef} className="block" />
          
          {/* Highlights Layer mapping absolute positions */}
          {!isRendering && !errorState && pageHighlights.map((hl) => {
            const isActive = hl.changeId === activeChangeId;
            return (
              <div
                key={hl.changeId}
                style={{
                  position: 'absolute',
                  left: hl.x * scaleX,
                  top: hl.y * scaleY,
                  width: hl.width * scaleX,
                  height: hl.height * scaleY,
                  backgroundColor: highlightColor,
                  border: `1.5px solid ${borderColor}`,
                  borderRadius: 2,
                  pointerEvents: 'none',
                }}
                className={`transition-all duration-300 ${
                  isActive ? 'ring-4 ring-offset-2 ring-indigo-500 animate-pulse border-2 shadow-lg z-30 scale-[1.01]' : ''
                }`}
              />
            );
          })}
        </div>

        {/* Fix 7: Better loading HUD */}
        {isRendering && !errorState && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 gap-3 z-20">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-500 font-semibold">
              {loadProgress !== null ? `Loading PDF... ${loadProgress}%` : 'Rendering page...'}
            </span>
          </div>
        )}

        {/* Fix 7: Better error UX */}
        {errorState && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-slate-50 z-20">
            <span className="text-3xl">⚠️</span>
            <p className="text-sm text-red-600 font-bold">PDF failed to load</p>
            <p className="text-xs text-gray-500 max-w-[280px] leading-relaxed">{errorState}</p>
            <a 
              href={url} 
              download 
              className="text-xs text-indigo-600 font-bold hover:underline bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm mt-2 transition"
            >
              Download PDF instead
            </a>
          </div>
        )}
      </div>
    </div>
  );
});

PdfPane.displayName = 'PdfPane';

// ─── Main PdfDiffViewer Export ───────────────────────────────────────────────
export default function PdfDiffViewer({
  resumeId,
  tailorId,
  changes,
  activeChangeId,
  onChangeIdChange,
}: PdfDiffViewerProps) {
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [highlights, setHighlights] = useState<HighlightRegion[]>([]);

  const originalRef = useRef<ScrollRef>(null);
  const tailoredRef = useRef<ScrollRef>(null);

  // Fix 6: Auto-derive highlights from changes if the endpoint fails
  const deriveHighlightsFromChanges = (changeList: Change[]): HighlightRegion[] => {
    return changeList.map(c => ({
      changeId: c.id,
      type: c.type,
      section: c.section,
      page: Math.floor(c.startLine / 54) + 1,
      x: 72,
      y: 72 + (c.startLine % 54) * 14,
      width: 451,
      height: Math.max((c.endLine - c.startLine + 1) * 14, 14),
      confidence: 'approximate' as const,
    }));
  };

  // Fix 6: Auto-load highlights inside component itself
  useEffect(() => {
    if (!tailorId) {
      setHighlights([]);
      return;
    }

    fetch(`/api/v1/tailor/${tailorId}/highlights`)
      .then(r => {
        if (!r.ok) throw new Error('Highlights fetch rejected');
        return r.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setHighlights(data);
        } else {
          // Empty highlights fallback
          setHighlights(deriveHighlightsFromChanges(changes));
        }
      })
      .catch((err) => {
        console.warn('Backend highlights unavailable, generating local approximations:', err);
        setHighlights(deriveHighlightsFromChanges(changes));
      });
  }, [tailorId, changes]);

  // Synchronized scrolling viewports
  const handleScroll = (side: 'left' | 'right') => (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (side === 'left') {
      tailoredRef.current?.syncScroll(target.scrollTop);
    } else {
      originalRef.current?.syncScroll(target.scrollTop);
    }
  };

  // Jump to highlight page when activeChangeId is triggered from plain text card click
  useEffect(() => {
    if (activeChangeId) {
      const activeHl = highlights.find(h => h.changeId === activeChangeId);
      if (activeHl && activeHl.page !== page) {
        setPage(activeHl.page);
      }
    }
  }, [activeChangeId, highlights, page]);

  // Fix 6: Auto-derive original and tailored endpoints
  const originalPdfUrl = `/api/v1/resumes/${resumeId}/pdf`;
  const tailoredPdfUrl = `/api/v1/tailor/${tailorId}/pdf`;

  return (
    <div className="space-y-3 bg-white p-5 border border-slate-200 rounded-xl shadow-sm">
      {/* Visual Header & Disclaimer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 gap-2">
        <div>
          <h3 className="m-0 text-md font-bold text-slate-800 flex items-center gap-2">
            <span>👁️</span> Visual Document Overlay
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Review side-by-side renders of the PDF documents with modifications highlighted.
          </p>
        </div>
        
        {/* Naive highlights approximation disclaimer */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200 uppercase tracking-wide self-start shadow-sm">
          <span>⚠️</span> Highlight positions are approximate
        </div>
      </div>

      {/* Grid PDF Viewers with locked-page synchronization */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PdfPane
          ref={originalRef}
          url={originalPdfUrl}
          label="Original Uploaded PDF"
          page={page}
          setPage={setPage}
          setNumPages={setNumPages}
          numPages={numPages}
          highlights={highlights.filter(h => h.type === 'removed' || h.type === 'modified')}
          highlightColor="rgba(239, 68, 68, 0.18)"
          borderColor="rgb(239, 68, 68)"
          activeChangeId={activeChangeId}
          onScroll={handleScroll('left')}
        />
        <PdfPane
          ref={tailoredRef}
          url={tailoredPdfUrl}
          label="AI-Tailored PDF"
          page={page}
          setPage={setPage}
          setNumPages={setNumPages}
          numPages={numPages}
          highlights={highlights.filter(h => h.type === 'added' || h.type === 'modified')}
          highlightColor="rgba(34, 197, 94, 0.18)"
          borderColor="rgb(34, 197, 94)"
          activeChangeId={activeChangeId}
          onScroll={handleScroll('right')}
        />
      </div>
    </div>
  );
}
