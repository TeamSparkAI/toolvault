import React from 'react';
import { getSeverityLevel } from '@/lib/severity';

interface SeverityDisplayProps {
  severity: number;
  showDescription?: boolean;
  iconSize?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function SeverityDisplay({ 
  severity, 
  showDescription = false,
  iconSize = 'md',
  className = ''
}: SeverityDisplayProps) {
  const severityLevel = getSeverityLevel(severity);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-shrink-0">
        {React.cloneElement(severityLevel.icon as React.ReactElement, { size: iconSize })}
      </div>
      <div>
        <span className="font-medium">{severity} - {severityLevel.name}</span>
        {showDescription && (
          <p className="text-gray-500 text-xs mt-1">{severityLevel.description}</p>
        )}
      </div>
    </div>
  );
} 