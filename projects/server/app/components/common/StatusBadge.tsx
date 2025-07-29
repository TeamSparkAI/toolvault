import React from 'react';

interface StatusBadgeProps {
  enabled: boolean;
  className?: string;
}

export function StatusBadge({ enabled, className = '' }: StatusBadgeProps) {
  return (
    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
      enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    } ${className}`}>
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
} 