import React from 'react';

interface ManagedBadgeProps {
  isManaged: boolean;
}

export function ManagedBadge({ isManaged }: ManagedBadgeProps) {
  const displayText = isManaged ? 'Yes' : 'No';
  const badgeClasses = isManaged 
    ? 'bg-green-100 text-green-800'
    : 'bg-red-100 text-red-800';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClasses}`}>
      {displayText}
    </span>
  );
} 