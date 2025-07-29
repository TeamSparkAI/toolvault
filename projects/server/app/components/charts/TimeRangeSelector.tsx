import React from 'react';
import { TimeRange } from '@/app/lib/utils/timeSeries';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  className?: string;
}

export function TimeRangeSelector({ value, onChange, className = '' }: TimeRangeSelectorProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-sm text-gray-600">Chart Time Range:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TimeRange)}
        className="text-sm border rounded px-2 py-1"
      >
        <option value="7days">Last 7 Days</option>
        <option value="30days">Last 30 Days</option>
        <option value="all">All Time</option>
      </select>
    </div>
  );
} 