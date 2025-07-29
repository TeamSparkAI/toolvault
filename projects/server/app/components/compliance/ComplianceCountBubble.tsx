import React from 'react';

interface ComplianceCountBubbleProps {
  count: number;
  className?: string;
}

export function ComplianceCountBubble({ count, className = '' }: ComplianceCountBubbleProps) {
  if (count === 0) {
    return null;
  }

  return (
    <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full ml-2 ${className}`}>
      {count}
    </span>
  );
} 