import { MessageTimeSeriesData } from '@/app/api/v1/analytics/messages/timeSeries/route';

export type TimeRange = '7days' | '30days' | 'all';

/**
 * Fills in missing days in time series data to ensure continuous data points
 * @param data The original time series data
 * @param startTime The start time for the range
 * @param endTime The end time for the range
 * @param timeRange The selected time range
 * @returns A new array of time series data with filled gaps
 */
export function fillTimeSeriesData(
  data: MessageTimeSeriesData[],
  startTime: Date,
  endTime: Date,
  timeRange?: TimeRange
): MessageTimeSeriesData[] {
  // If no data, return empty array
  if (!data.length) return [];

  // Get unique server names from the time series data
  const serverNames = Array.from(new Set(
    data.flatMap(d => Object.keys(d.counts))
  ));

  // For "all" time range, use the earliest date from the data
  if (timeRange === 'all') {
    const earliestDate = new Date(Math.min(...data.map(d => new Date(d.timestamp).getTime())));
    startTime = new Date(earliestDate);
  }

  // Create array of all days in range
  const allDays = [];
  for (let d = new Date(startTime); d <= endTime; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    allDays.push(dateStr);
  }

  // Create a map of existing data by date for quick lookup
  const existingDataMap = new Map(
    data.map(d => [d.timestamp.split('T')[0], d])
  );

  // Create new data array with zero-filled days for the entire range
  return allDays.map(dateStr => {
    const existingData = existingDataMap.get(dateStr);
    if (existingData) {
      return {
        timestamp: existingData.timestamp,
        counts: Object.fromEntries(serverNames.map(name => [name, existingData.counts[name] || 0]))
      };
    }
    return {
      timestamp: dateStr,
      counts: Object.fromEntries(serverNames.map(name => [name, 0]))
    };
  });
}

/**
 * Calculates the start and end times for a given time range
 * @param timeRange The selected time range
 * @returns An object containing start and end times
 */
export function calculateTimeRange(timeRange: TimeRange): { startTime: Date; endTime: Date } {
  const endTime = new Date();
  const startTime = new Date();

  if (timeRange === '7days') {
    startTime.setDate(startTime.getDate() - 6);
  } else if (timeRange === '30days') {
    startTime.setDate(startTime.getDate() - 29);
  }

  return { startTime, endTime };
} 