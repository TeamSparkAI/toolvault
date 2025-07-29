import React from 'react';

interface AlertCountBubbleProps {
  count: number;
  className?: string;
}

export function AlertCountBubble({ count, className = '' }: AlertCountBubbleProps) {
  if (count === 0) {
    return null;
  }

  return (
    <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full ml-2 ${className}`}>
      {count}
    </span>
  );
} 