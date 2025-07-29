import { useState } from 'react';
import { useTimeSeriesData } from '../charts/useTimeSeriesData';
import { TimeSeriesChart } from '../charts/TimeSeriesChart';
import { TimeRange } from '@/app/lib/utils/timeSeries';
import { Dimensions } from '@/app/hooks/useDimensions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toggleFilterInUrl } from '@/app/lib/utils/urlParams';

interface DashboardChartProps {
  dimension: 'serverName' | 'policyId' | 'clientId' | 'clientType';
  timeRange: TimeRange;
  filters?: Record<string, string>;
  dimensions?: Dimensions;
}

export function DashboardChart({ dimension, timeRange: initialTimeRange, filters = {}, dimensions }: DashboardChartProps) {
  const router = useRouter();
  const [timeRange] = useState(initialTimeRange);
  
  const { data, isLoading, error } = useTimeSeriesData({
    dimension,
    timeRange,
    filters
  });

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[300px] flex items-center justify-center text-red-500">
        Error: {error}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-500">
        No data available for the selected time period
      </div>
    );
  }

  const reviewLink = dimension === 'policyId' ? '/alerts' : '/messages';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          {dimension === 'policyId' ? 'Alerts by Policy' : 'Messages by Server'} {timeRange === '7days' ? '(Last 7 Days)' : timeRange === '30days' ? '(Last 30 Days)' : '(All Time)'}
        </h2>
        <Link 
          href={reviewLink}
          className="text-blue-500 hover:text-blue-700 text-sm font-medium"
        >
          Review
        </Link>
      </div>
      
      <div className="h-[300px] relative">
        <TimeSeriesChart 
          data={data} 
          height={300} 
          dimensions={dimensions} 
          dimension={dimension}
          onLegendClick={(entry) => {
            if (dimension === 'policyId') {
              // For alerts chart, navigate to alerts filtered by policy
              const dataKey = String(entry.dataKey);
              const policyId = dataKey.replace('counts.', '');
              const newURL = toggleFilterInUrl('policyId', policyId);
              router.push(`/alerts${newURL}`);
            } else if (dimension === 'serverName') {
              // For messages chart, navigate to messages filtered by server
              const dataKey = String(entry.dataKey);
              const serverName = dataKey.replace('counts.', '');
              const newURL = toggleFilterInUrl('serverName', serverName);
              router.push(`/messages${newURL}`);
            }
          }}
        />
      </div>
    </div>
  );
} 