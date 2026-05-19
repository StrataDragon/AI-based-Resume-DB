import React, { useState } from 'react';
import { Change } from '@/types/tailoring';

interface ResumeDiffPreviewProps {
  changes: Change[];
  originalContent: string;
  tailoredContent: string;
}

export default function ResumeDiffPreview({
  changes,
  originalContent,
  tailoredContent
}: ResumeDiffPreviewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  const toggleSection = (section: string) => {
    const updated = new Set(expandedSections);
    if (updated.has(section)) {
      updated.delete(section);
    } else {
      updated.add(section);
    }
    setExpandedSections(updated);
  };

  if (changes.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-4">
        <p>No changes made to the resume.</p>
      </div>
    );
  }

  const groupedChanges = changes.reduce((acc, change) => {
    if (!acc[change.section]) {
      acc[change.section] = [];
    }
    acc[change.section].push(change);
    return acc;
  }, {} as Record<string, Change[]>);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-4">
      <h3 className="mt-0 text-base text-gray-800">📋 Changes Preview</h3>

      {Object.entries(groupedChanges).map(([section, sectionChanges]) => (
        <div key={section} className="mb-3 border border-gray-200 rounded-md overflow-hidden">
          <div
            className="flex items-center justify-between p-3 bg-gray-100 cursor-pointer hover:bg-gray-200 select-none"
            onClick={() => toggleSection(section)}
            role="button"
            tabIndex={0}
          >
            <span className="font-semibold text-gray-800">
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </span>
            <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">
              {sectionChanges.length} change{sectionChanges.length !== 1 ? 's' : ''}
            </span>
            <span className={`text-gray-500 transition-transform ${expandedSections.has(section) ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>

          {expandedSections.has(section) && (
            <div className="p-3 bg-white border-t border-gray-200">
              {sectionChanges.map((change, idx) => (
                <div key={idx} className={`mb-3 p-3 rounded-md border-l-4 ${
                  change.type === 'added' ? 'bg-green-50 border-green-500' :
                  change.type === 'removed' ? 'bg-red-50 border-red-500' :
                  'bg-blue-50 border-blue-600'
                }`}>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <span className="font-medium text-sm">
                      {change.type === 'added' && '➕ Added'}
                      {change.type === 'removed' && '❌ Removed'}
                      {change.type === 'modified' && '📝 Modified'}
                    </span>
                    <div className="flex gap-1.5">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-black/5 text-gray-700">
                        {(change.relevanceToJD * 100).toFixed(0)}% JD Match
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-black/5 text-gray-700">
                        {(change.confidence * 100).toFixed(0)}% Confidence
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {change.type !== 'added' && (
                      <div>
                        <label className="block font-medium text-xs text-gray-500 mb-1 uppercase tracking-wide">Before:</label>
                        <p className="m-0 p-2 bg-black/5 rounded leading-relaxed">{change.original}</p>
                      </div>
                    )}

                    {change.type !== 'removed' && (
                      <div>
                        <label className="block font-medium text-xs text-gray-500 mb-1 uppercase tracking-wide">After:</label>
                        <p className="m-0 p-2 bg-black/5 rounded leading-relaxed">{change.tailored}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
