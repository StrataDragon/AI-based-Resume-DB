import React, { useEffect, useState } from 'react';

interface TailoringStatusProps {
  progress: number;
  estimatedTime?: number | null;
  stage?: string;
}

export default function TailoringStatus({
  progress,
  estimatedTime,
  stage
}: TailoringStatusProps) {
  const [displayedProgress, setDisplayedProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayedProgress(prev => Math.min(prev + 1, progress));
    }, 50);

    return () => clearInterval(interval);
  }, [progress]);

  const stageMessages: Record<string, string> = {
    'analyzing': '📊 Analyzing your resume...',
    'tailoring': '✨ Tailoring content...',
    'generating_docx': '📄 Generating document...',
    'finalizing': '🔍 Finalizing...'
  };

  const tips = [
    '💡 Pro tip: Add specific technical keywords from the job description',
    '💡 Pro tip: Highlight quantifiable achievements and impact',
    '💡 Pro tip: Match the company culture and tone in your resume',
    '💡 Pro tip: Keep your resume between 1-2 pages for ATS compatibility',
    '💡 Pro tip: Use action verbs to start each bullet point'
  ];

  const randomTip = tips[Math.floor(Math.random() * tips.length)];

  return (
    <div className="flex flex-col items-center gap-5 p-10 text-center">
      <div className="h-12 w-12 rounded-full border-4 border-indigo-100 border-t-blue-600 animate-spin"></div>

      <h3 className="text-lg font-semibold text-gray-800 m-0">
        {stageMessages[stage || ''] || '⏳ Processing...'}
      </h3>

      <div className="flex items-center gap-3 w-full max-w-[300px]">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{ 
              width: `${displayedProgress}%`,
              background: 'linear-gradient(90deg, #0066cc, #0052a3)'
            }}
          ></div>
        </div>
        <div className="font-semibold text-blue-700 min-w-[40px] text-sm">
          {displayedProgress}%
        </div>
      </div>

      {estimatedTime && (
        <p className="text-sm text-gray-600 m-0">
          ⏱️ Estimated time remaining: {formatEstimatedTime(estimatedTime)}
        </p>
      )}

      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded text-sm text-yellow-800 max-w-[300px]">
        {randomTip}
      </div>
    </div>
  );
}

function formatEstimatedTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}m`;
}
