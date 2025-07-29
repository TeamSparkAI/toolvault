import React from 'react';

interface SecurityStatusBadgeProps {
  isUnmanaged: boolean;
  enabled?: boolean;
}

export function SecurityStatusBadge({ isUnmanaged, enabled }: SecurityStatusBadgeProps) {
  if (isUnmanaged) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Unmanaged
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      enabled 
        ? 'bg-green-100 text-green-800' 
        : 'bg-red-100 text-red-800'
    }`}>
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
} 