import React from 'react';
import { useAlerts } from '@/app/contexts/AlertsContext';
import { getSeverityLevel, getSeverityColor } from '@/lib/severity';
import { useRouter } from 'next/navigation';
import { AlertFilter } from '@/lib/models/types/alert';
import { applyOnlyFilter, removeAllFilters } from '@/app/lib/utils/urlParams';

interface NewAlertsSummaryProps {
  showSeparator?: boolean;
  showReviewLink?: boolean;
  currentFilters?: AlertFilter;
}

export function NewAlertsSummary({ showSeparator = false, showReviewLink = false, currentFilters }: NewAlertsSummaryProps) {
  const { unseenAlerts } = useAlerts();
  const { bySeverity } = unseenAlerts;
  const totalUnseen = Object.values(bySeverity).reduce((sum, count) => sum + count, 0);
  const router = useRouter();

  if (totalUnseen === 0) {
    return null;
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">New Policy Alerts</h2>
          {showReviewLink && (
            <a
              href="/alerts"
              className="text-blue-500 text-sm hover:underline"
            >
              Review
            </a>
          )}
        </div>
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(severity => {
            const count = bySeverity[severity] || 0;
            const isSelected = currentFilters?.severity === severity;
            const severityColor = getSeverityColor(severity);
            
            return (
              <div 
                key={severity}
                className={`flex flex-col items-center p-4 rounded-lg cursor-pointer hover:opacity-80 transition-all ${
                  isSelected 
                    ? 'ring-2 ring-offset-2 shadow-lg' 
                    : ''
                }`}
                style={{ 
                  backgroundColor: `${severityColor}20`,
                  ...(isSelected && {
                    backgroundColor: `${severityColor}30`,
                    borderColor: severityColor
                  })
                }}
                onClick={() => {
                  if (isSelected) {
                    // If clicking the same severity that's already selected, clear all filters
                    const newURL = removeAllFilters();
                    router.push(`/alerts${newURL}`);
                  } else {
                    // If clicking a different severity, apply only this severity filter
                    const newURL = applyOnlyFilter('severity', severity);
                    router.push(`/alerts${newURL}`);
                  }
                }}
              >
                <span className="text-lg font-semibold" style={{ color: severityColor }}>
                  {count}
                </span>
                <span className={`text-sm ${isSelected ? 'font-medium' : 'text-gray-600'}`}>
                  {getSeverityLevel(severity).name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {showSeparator && (
        <div className="border-t border-gray-400" />
      )}
    </>
  );
} 