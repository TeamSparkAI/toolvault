import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MessageTimeSeriesData } from '@/app/api/v1/analytics/messages/timeSeries/route';
import { Dimensions } from '@/app/hooks/useDimensions';
import { useRouter } from 'next/navigation';
import { toggleFilterInUrl } from '@/app/lib/utils/urlParams';

interface TimeSeriesChartProps {
  data: MessageTimeSeriesData[];
  height?: number;
  dimensions?: Dimensions;
  dimension?: 'serverName' | 'policyId' | 'clientId' | 'clientType';
  onLegendClick?: (entry: any) => void;
}

export function TimeSeriesChart({ data, height = 300, dimensions, dimension, onLegendClick }: TimeSeriesChartProps) {
  
  // Get unique server names from the data
  const serverNames = Array.from(new Set(
    data.flatMap(item => Object.keys(item.counts))
  ));

  // Define colors for each server
  const COLORS = [
    '#2563eb', // blue-600
    '#dc2626', // red-600
    '#16a34a', // green-600
    '#ca8a04', // yellow-600
    '#9333ea', // purple-600
    '#ea580c', // orange-600
    '#0891b2', // cyan-600
    '#be185d', // pink-600
  ];

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={(value: string) => {
              const [year, month, day] = value.split('-').map(Number);
              const date = new Date(Date.UTC(year, month - 1, day));
              // Use UTC methods to avoid timezone conversion
              const monthName = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
              const dayNum = date.getUTCDate();
              return `${monthName} ${dayNum}`;
            }}
          />
          <YAxis />
          <Tooltip 
            labelFormatter={(value: string) => {
              const [year, month, day] = value.split('-').map(Number);
              const date = new Date(Date.UTC(year, month - 1, day));
              return date.toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric',
                timeZone: 'UTC'
              });
            }}
            formatter={(value: number, name: string) => {
              if (dimensions && dimension) {
                const label = dimensions.getLabel(dimension, name);
                return [value, label || name];
              }
              return [value, name];
            }}
          />
          <Legend 
            formatter={(name: string) => {
              if (dimensions && dimension) {
                return dimensions.getLabel(dimension, name) || name;
              }
              return name;
            }}
            onClick={onLegendClick}
          />
          {serverNames.map((serverName, index) => (
            <Line
              key={serverName}
              type="monotone"
              dataKey={`counts.${serverName}`}
              name={serverName}
              stroke={COLORS[index % COLORS.length]}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
} 