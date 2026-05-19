import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { useTailoringWorkflow } from '@/hooks/useTailoringWorkflow';
import TailoringStatus from './TailoringStatus';
import ResumeDiffPreview from '@/components/ResumeDiffPreview';
import { TailoredResumeResult } from '@/types/tailoring';

interface AutoTailorSectionProps {
  resumeId: string;
  jdId: string;
  onComplete?: (result: TailoredResumeResult) => void;
}

export default function AutoTailorSection({
  resumeId,
  jdId,
  onComplete
}: AutoTailorSectionProps) {
  const workflow = useTailoringWorkflow();
  const [customInstructions, setCustomInstructions] = useState('');
  const [template, setTemplate] = useState<'current' | 'index_html'>('index_html');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleStartTailoring = async () => {
    try {
      await workflow.startTailoring(resumeId, jdId, {
        customInstructions: customInstructions || undefined,
        template
      });

      if (workflow.result && onComplete) {
        onComplete(workflow.result);
      }
    } catch (error) {
      console.error('Tailoring error:', error);
    }
  };

  const isLoading = workflow.stage === 'processing';
  const isComplete = workflow.stage === 'preview' || workflow.stage === 'complete';
  const hasError = workflow.stage === 'error';

  return (
    <Card className="rounded-xl border-2 border-indigo-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Auto-Tailor Resume</h2>
        <p className="text-sm text-gray-600">Choose the template you want, then generate a tailored DOCX for this job. The system will rewrite only existing resume facts and will not invent new experience, dates, or skills.</p>
      </div>

      {hasError && (
        <Alert variant="destructive" className="mb-4">
          <strong>Error:</strong> {workflow.error?.message}
          <Button
            variant="secondary"
            size="sm"
            onClick={workflow.reset}
            className="mt-2"
          >
            Try Again
          </Button>
        </Alert>
      )}

      {isLoading && (
        <TailoringStatus
          progress={workflow.progress}
          estimatedTime={workflow.estimatedTimeRemaining}
          stage={workflow.processingStatus?.stage}
        />
      )}

      {isComplete && workflow.result && (
        <div className="flex flex-col gap-4">
          <Alert className="border-green-200 bg-green-50 text-green-800">
            Resume tailored successfully.
          </Alert>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricCard
              label="Before"
              value={`${workflow.result.metadata.matchScoreBefore}%`}
            />
            <MetricCard
              label="After"
              value={`${workflow.result.metadata.matchScoreAfter}%`}
              highlight
            />
            <MetricCard
              label="Improvement"
              value={`+${workflow.result.metadata.improvementPercent}%`}
              variant="success"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700">
            Template used: <span className="font-semibold">{workflow.result.metadata.template === 'index_html' ? 'Index HTML Template' : 'Current Template'}</span>
          </div>

          <ResumeDiffPreview
            changes={workflow.result.changes}
            originalContent={workflow.result.originalResume.content}
            tailoredContent={workflow.result.tailoredResume.content}
          />

          <Button
            size="lg"
            onClick={workflow.downloadResume}
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
          >
            Download Tailored DOCX
          </Button>

          <Button
            variant="outline"
            onClick={workflow.reset}
            className="w-full"
          >
            Tailor Again
          </Button>
        </div>
      )}

      {!isLoading && !isComplete && !hasError && (
        <form onSubmit={(e) => { e.preventDefault(); handleStartTailoring(); }}>
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium text-slate-800">Choose resume template</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={`cursor-pointer rounded-xl border p-4 transition ${template === 'current' ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 bg-white/70'}`}>
                <input
                  type="radio"
                  name="template"
                  value="current"
                  checked={template === 'current'}
                  onChange={() => setTemplate('current')}
                  className="sr-only"
                />
                <div className="text-sm font-semibold text-slate-900">Current Template</div>
                <div className="mt-1 text-xs text-slate-600">Use the existing ATS-friendly DOCX layout already in the app.</div>
              </label>

              <label className={`cursor-pointer rounded-xl border p-4 transition ${template === 'index_html' ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 bg-white/70'}`}>
                <input
                  type="radio"
                  name="template"
                  value="index_html"
                  checked={template === 'index_html'}
                  onChange={() => setTemplate('index_html')}
                  className="sr-only"
                />
                <div className="text-sm font-semibold text-slate-900">Index HTML Template</div>
                <div className="mt-1 text-xs text-slate-600">Use the two-column styled layout inspired by `resume_template/index.html`.</div>
              </label>
            </div>
          </div>

          <Textarea
            placeholder="Optional: Add custom instructions (e.g., 'Emphasize my cloud architecture experience')"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            rows={3}
            className="mb-3 w-full rounded-lg border border-gray-300 p-3 text-sm font-sans"
          />

          <div className="my-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showAdvanced}
                onChange={(e) => setShowAdvanced(e.target.checked)}
              />
              Advanced Options
            </label>
          </div>

          {showAdvanced && (
            <div className="mb-4 rounded-lg border border-indigo-100 bg-white/50 p-4 text-sm text-gray-600">
              Current output template: <span className="font-semibold">{template === 'index_html' ? 'Index HTML Template' : 'Current Template'}</span>.
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <Button
              size="lg"
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
            >
              {isLoading ? 'Tailoring...' : 'Generate Tailored Resume'}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function MetricCard({
  label,
  value,
  highlight,
  variant = 'default'
}: {
  label: string;
  value: string;
  highlight?: boolean;
  variant?: 'default' | 'success';
}) {
  const bgColor = variant === 'success' ? '#f0fdf4' : highlight ? '#eff6ff' : '#f9fafb';
  const borderColor = variant === 'success' ? '#86efac' : highlight ? '#93c5fd' : '#e5e7eb';
  const textColor = variant === 'success' ? '#22c55e' : '#2563eb';

  return (
    <div
      style={{
        padding: '12px',
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        backgroundColor: bgColor,
        textAlign: 'center'
      }}
    >
      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: '20px',
          fontWeight: '600',
          color: textColor
        }}
      >
        {value}
      </div>
    </div>
  );
}
