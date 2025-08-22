import React from 'react';

interface UnpinnedBadgeProps {
  isUnpinned: boolean;
}

export function UnpinnedBadge({ isUnpinned }: UnpinnedBadgeProps) {
  if (!isUnpinned) {
    return null;
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
      Unpinned
    </span>
  );
}
