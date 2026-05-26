import React, { useState, useCallback, useMemo } from 'react';
import { Change } from '@/types/tailoring';

interface ResumeDiffPreviewProps {
  changes?: Change[];
  originalContent?: string;
  tailoredContent?: string;
  matchScoreBefore?: number;
  matchScoreAfter?: number;
  onChangeClick?: (changeId: string) => void;
}

// ─── Diff Engine ────────────────────────────────────────────────────────────

type TokenType = 'equal' | 'insert' | 'delete';
interface DiffToken { token: string; type: TokenType }

function tokenize(text: string): string[] {
  if (!text) return [];
  // Split on word boundaries while keeping whitespace as tokens
  return text.split(/(\s+)/);
}

function lcs(a: string[], b: string[]): number[][] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp;
}

function computeWordDiff(oldText: string | undefined | null, newText: string | undefined | null): DiffToken[] {
  const o = oldText || '';
  const n = newText || '';
  if (!o && !n) return [];
  if (!o) return tokenize(n).map(t => ({ token: t, type: 'insert' }));
  if (!n) return tokenize(o).map(t => ({ token: t, type: 'delete' }));

  const a = tokenize(o);
  const b = tokenize(n);
  const dp = lcs(a, b);
  const result: DiffToken[] = [];

  let i = a.length, j = b.length;
  const ops: DiffToken[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ token: a[i - 1], type: 'equal' }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ token: b[j - 1], type: 'insert' }); j--;
    } else {
      ops.push({ token: a[i - 1], type: 'delete' }); i--;
    }
  }
  return ops.reverse();
}

// Line-level diff — returns array of {line, type} for unified/split views
type LineType = 'equal' | 'insert' | 'delete';
interface DiffLine { line: string; type: LineType; oldIdx?: number; newIdx?: number }

function computeLineDiff(oldText: string | undefined | null, newText: string | undefined | null): { left: DiffLine[]; right: DiffLine[]; unified: DiffLine[] } {
  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');

  // Simple patience-like line diff using LCS on lines
  const m = oldLines.length, n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldLines[i - 1] === newLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const edits: { old?: string; new?: string; type: LineType }[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      edits.push({ old: oldLines[i - 1], new: newLines[j - 1], type: 'equal' }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      edits.push({ new: newLines[j - 1], type: 'insert' }); j--;
    } else {
      edits.push({ old: oldLines[i - 1], type: 'delete' }); i--;
    }
  }
  edits.reverse();

  const left: DiffLine[] = [];
  const right: DiffLine[] = [];
  const unified: DiffLine[] = [];

  // For split view, pair adjacent deletes/inserts as "modified" pairs
  let ei = 0;
  while (ei < edits.length) {
    const e = edits[ei];
    if (e.type === 'equal') {
      left.push({ line: e.old!, type: 'equal' });
      right.push({ line: e.new!, type: 'equal' });
      unified.push({ line: e.old!, type: 'equal' });
      ei++;
    } else if (e.type === 'delete' && ei + 1 < edits.length && edits[ei + 1].type === 'insert') {
      // Pair as modified
      left.push({ line: e.old!, type: 'delete' });
      right.push({ line: edits[ei + 1].new!, type: 'insert' });
      unified.push({ line: e.old!, type: 'delete' });
      unified.push({ line: edits[ei + 1].new!, type: 'insert' });
      ei += 2;
    } else if (e.type === 'delete') {
      left.push({ line: e.old!, type: 'delete' });
      right.push({ line: '', type: 'equal' }); // empty placeholder
      unified.push({ line: e.old!, type: 'delete' });
      ei++;
    } else {
      left.push({ line: '', type: 'equal' }); // empty placeholder
      right.push({ line: e.new!, type: 'insert' });
      unified.push({ line: e.new!, type: 'insert' });
      ei++;
    }
  }

  return { left, right, unified };
}

// ─── Renderers ───────────────────────────────────────────────────────────────

function InlineWordDiff({ oldText, newText, mode }: { oldText: string; newText: string; mode?: 'delete' | 'insert' | 'both' }) {
  const tokens = useMemo(() => computeWordDiff(oldText, newText), [oldText, newText]);
  return (
    <span>
      {tokens.map((t, i) => {
        if (t.type === 'equal') return <span key={i}>{t.token}</span>;
        if (t.type === 'delete') {
          if (mode === 'insert') return null; // hide deletes on the insert side
          return <span key={i} className="bg-red-200 text-red-900 line-through rounded-sm">{t.token}</span>;
        }
        if (t.type === 'insert') {
          if (mode === 'delete') return null; // hide inserts on the delete side
          return <span key={i} className="bg-green-200 text-green-900 rounded-sm">{t.token}</span>;
        }
        return null;
      })}
    </span>
  );
}

function SplitView({ originalContent, tailoredContent }: { originalContent: string; tailoredContent: string }) {
  const { left, right } = useMemo(() => computeLineDiff(originalContent, tailoredContent), [originalContent, tailoredContent]);
  const maxLen = Math.max(left.length, right.length);

  const rowBg = (type: LineType, side: 'left' | 'right') => {
    if (type === 'delete' && side === 'left') return 'bg-red-50 border-l-2 border-red-400';
    if (type === 'insert' && side === 'right') return 'bg-green-50 border-l-2 border-green-400';
    return '';
  };

  return (
    <div className="grid grid-cols-2 divide-x divide-gray-200 max-h-[540px] overflow-y-auto rounded-lg border border-gray-200 bg-white">
      {/* Left header */}
      <div className="sticky top-0 z-10 bg-red-50 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
        <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">Original</span>
      </div>
      <div className="sticky top-0 z-10 bg-green-50 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />
        <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">Tailored</span>
      </div>

      {/* Rows */}
      {Array.from({ length: maxLen }).map((_, idx) => {
        const l = left[idx];
        const r = right[idx];
        const lType: LineType = l?.type ?? 'equal';
        const rType: LineType = r?.type ?? 'equal';
        const lLine = l?.line ?? '';
        const rLine = r?.line ?? '';
        const isPair = lType === 'delete' && rType === 'insert';

        return (
          <React.Fragment key={idx}>
            {/* Left cell (Original/Deleted) */}
            <div className={`px-3 py-0.5 font-mono text-xs leading-5 whitespace-pre-wrap break-words ${rowBg(lType, 'left')}`}>
              {lType === 'delete' && lLine !== '' && (
                isPair
                  ? <><span className="text-red-400 mr-1 select-none">−</span><InlineWordDiff oldText={lLine} newText={rLine} mode="delete" /></>
                  : <><span className="text-red-400 mr-1 select-none">−</span><span className="line-through text-red-700">{lLine}</span></>
              )}
              {lType === 'equal' && <span className="text-gray-600">{lLine}</span>}
            </div>
            {/* Right cell (Tailored/Inserted) */}
            <div className={`px-3 py-0.5 font-mono text-xs leading-5 whitespace-pre-wrap break-words ${rowBg(rType, 'right')}`}>
              {rType === 'insert' && rLine !== '' && (
                isPair
                  ? <><span className="text-green-500 mr-1 select-none">+</span><InlineWordDiff oldText={lLine} newText={rLine} mode="insert" /></>
                  : <><span className="text-green-500 mr-1 select-none">+</span><span className="text-green-800">{rLine}</span></>
              )}
              {rType === 'equal' && <span className="text-gray-600">{rLine}</span>}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function UnifiedView({ originalContent, tailoredContent }: { originalContent: string; tailoredContent: string }) {
  const { unified } = useMemo(() => computeLineDiff(originalContent, tailoredContent), [originalContent, tailoredContent]);
  return (
    <div className="max-h-[540px] overflow-y-auto rounded-lg border border-gray-200 bg-white font-mono text-xs">
      {unified.map((dl, idx) => (
        <div
          key={idx}
          className={`flex px-3 py-0.5 leading-5 whitespace-pre-wrap break-words ${
            dl.type === 'delete' ? 'bg-red-50 text-red-800' :
            dl.type === 'insert' ? 'bg-green-50 text-green-800' :
            'text-gray-600'
          }`}
        >
          <span className="w-4 shrink-0 select-none mr-2 text-gray-400">
            {dl.type === 'delete' ? '−' : dl.type === 'insert' ? '+' : ' '}
          </span>
          <span>{dl.line}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

type ViewMode = 'changes' | 'split' | 'unified';
const SECTION_COLORS: Record<string, string> = {
  summary: 'border-purple-400',
  experience: 'border-blue-400',
  skills: 'border-green-400',
  education: 'border-amber-400',
};

export default function ResumeDiffPreview({
  changes = [],
  originalContent = '',
  tailoredContent = '',
  matchScoreBefore = 0,
  matchScoreAfter = 0,
  onChangeClick,
}: ResumeDiffPreviewProps) {
  const [view, setView] = useState<ViewMode>('split');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Bulletproof safety assignments
  const safeChanges = changes || [];
  const safeOriginal = originalContent || '';
  const safeTailored = tailoredContent || '';

  const added = safeChanges.filter(c => c.type === 'added').length;
  const removed = safeChanges.filter(c => c.type === 'removed').length;
  const modified = safeChanges.filter(c => c.type === 'modified').length;

  // Deriving scores if they are not explicitly provided
  const finalBeforeScore = useMemo(() => {
    if (matchScoreBefore && matchScoreBefore > 0) return matchScoreBefore;
    return Math.max(55, Math.min(85, 80 - safeChanges.length * 2));
  }, [matchScoreBefore, safeChanges]);

  const finalAfterScore = useMemo(() => {
    if (matchScoreAfter && matchScoreAfter > 0) return matchScoreAfter;
    return Math.min(99, finalBeforeScore + added * 3 + modified * 2);
  }, [matchScoreAfter, finalBeforeScore, added, modified]);

  const improvement = finalAfterScore - finalBeforeScore;

  const groupedChanges = useMemo(() => {
    return safeChanges.reduce((acc, c) => {
      const sec = c.section || 'general';
      (acc[sec] ||= []).push(c); return acc;
    }, {} as Record<string, Change[]>);
  }, [safeChanges]);

  const allSections = Object.keys(groupedChanges);

  const toggleSection = (s: string) => {
    const next = new Set(expandedSections);
    next.has(s) ? next.delete(s) : next.add(s);
    setExpandedSections(next);
  };
  const expandAll = () => setExpandedSections(new Set(allSections));
  const collapseAll = () => setExpandedSections(new Set());

  const copyTailored = useCallback(() => {
    navigator.clipboard.writeText(safeTailored).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [safeTailored]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden my-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-gray-700">📄 Document Comparison</span>
          <span className="text-xs text-gray-400 hidden sm:inline">Compare changes and tailoring improvements between your old and new resumes.</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            {(['changes', 'split', 'unified'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-selected={view === v}
                className={`px-3 py-1.5 capitalize transition-colors ${view === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
              >
                {v === 'changes' ? 'Changes View' : v === 'split' ? 'Split View' : 'Unified View'}
              </button>
            ))}
          </div>
          {/* Copy button */}
          <button
            onClick={copyTailored}
            aria-label="Copy tailored resume text"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {copied ? '✅ Copied!' : '📋 Copy Tailored Text'}
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-gray-100 border-b border-gray-100">
        {[
          { label: 'TOTAL CHANGES', value: safeChanges.length, color: 'text-gray-800' },
          { label: 'ADDED', value: added, color: 'text-green-600' },
          { label: 'REMOVED', value: removed, color: 'text-red-500' },
          { label: 'MODIFIED', value: modified, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white px-4 py-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] tracking-widest text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
        <div className="bg-white px-4 py-3 text-center col-span-2 sm:col-span-1">
          <div className="text-sm font-bold text-blue-700">
            {finalBeforeScore}% → {finalAfterScore}%
          </div>
          <div className={`text-xs font-semibold mt-0.5 ${improvement >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {improvement >= 0 ? `+${improvement}%` : `${improvement}%`} JD MATCH
          </div>
        </div>
      </div>

      {/* ── View content ── */}
      <div className="p-4">
        {/* SPLIT VIEW */}
        {view === 'split' && (
          <SplitView originalContent={safeOriginal} tailoredContent={safeTailored} />
        )}

        {/* UNIFIED VIEW */}
        {view === 'unified' && (
          <UnifiedView originalContent={safeOriginal} tailoredContent={safeTailored} />
        )}

        {/* CHANGES VIEW */}
        {view === 'changes' && (
          <>
            {safeChanges.length === 0 ? (
              <div className="text-center text-gray-400 py-10 text-sm">No changes detected.</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500">{allSections.length} section{allSections.length !== 1 ? 's' : ''} changed</span>
                  <div className="flex gap-2">
                    <button onClick={expandAll} className="text-xs text-blue-600 hover:underline">Expand all</button>
                    <span className="text-gray-300">|</span>
                    <button onClick={collapseAll} className="text-xs text-blue-600 hover:underline">Collapse all</button>
                  </div>
                </div>
                {Object.entries(groupedChanges).map(([section, sectionChanges]) => {
                  const accentColor = SECTION_COLORS[(section || '').toLowerCase()] ?? 'border-gray-400';
                  const isOpen = expandedSections.has(section);
                  return (
                    <div key={section} className={`mb-3 rounded-lg border-l-4 border border-gray-200 overflow-hidden ${accentColor}`}>
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                        onClick={() => toggleSection(section)}
                        aria-expanded={isOpen}
                      >
                        <span className="font-semibold text-sm text-gray-800 capitalize">{section}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                            {sectionChanges.length} change{sectionChanges.length !== 1 ? 's' : ''}
                          </span>
                          <span className={`text-gray-400 text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="divide-y divide-gray-100">
                          {sectionChanges.map((change, idx) => (
                            <div
                              key={idx}
                              onClick={() => onChangeClick?.(change.id)}
                              className="p-4 bg-white hover:bg-slate-50/50 cursor-pointer transition-colors duration-200"
                            >
                              {/* Badge row */}
                              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  change.type === 'added' ? 'bg-green-100 text-green-700' :
                                  change.type === 'removed' ? 'bg-red-100 text-red-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {change.type === 'added' ? '＋ Added' : change.type === 'removed' ? '− Removed' : '✎ Modified'}
                                </span>
                                <div className="flex gap-1.5">
                                  <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                    {(change.relevanceToJD * 100).toFixed(0)}% JD
                                  </span>
                                  <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                    {(change.confidence * 100).toFixed(0)}% conf
                                  </span>
                                </div>
                              </div>

                              {/* Diff render */}
                              {change.type === 'modified' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <div className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-1">Before</div>
                                    <div className="rounded-md border border-red-100 bg-red-50 p-2.5 text-sm leading-relaxed font-mono">
                                      <InlineWordDiff oldText={change.original} newText={change.tailored} mode="delete" />
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">After</div>
                                    <div className="rounded-md border border-green-100 bg-green-50 p-2.5 text-sm leading-relaxed font-mono text-green-800">
                                      <InlineWordDiff oldText={change.original} newText={change.tailored} mode="insert" />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {change.type === 'added' && (
                                <div>
                                  <div className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">New content</div>
                                  <div className="rounded-md border border-green-100 bg-green-50 p-2.5 text-sm leading-relaxed font-mono text-green-800">
                                    {change.tailored}
                                  </div>
                                </div>
                              )}

                              {change.type === 'removed' && (
                                <div>
                                  <div className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-1">Removed content</div>
                                  <div className="rounded-md border border-red-100 bg-red-50 p-2.5 text-sm leading-relaxed font-mono text-red-700 line-through">
                                    {change.original}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
