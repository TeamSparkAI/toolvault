import React, { useEffect, useState } from 'react';

interface ClientEndpointLogEntry {
  timestamp: string;
  message: string;
  type: string;
  clientName?: string;
  data?: Record<string, any>;
}

interface ServerLogsTabProps {
  serverToken: string;
}

export function ServerLogsTab({ serverToken }: ServerLogsTabProps) {
  const [logs, setLogs] = useState<ClientEndpointLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/bridge/clients/${encodeURIComponent(serverToken)}/logs`);
      if (!res.ok) throw new Error(`Failed to fetch logs: ${res.statusText}`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [serverToken]);

  if (loading) return <div className="text-gray-500">Loading logs...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!logs.length) return (
    <div className="text-gray-500">
      No logs found for this server.{' '}
      <button
        onClick={() => {
          setLoading(true);
          setError(null);
          fetchLogs();
        }}
        disabled={loading}
        className="ml-1 text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Refresh logs"
      >
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="flex justify-between items-center">
                <span>Message</span>
                <button
                  onClick={() => {
                    setLoading(true);
                    setError(null);
                    fetchLogs();
                  }}
                  disabled={loading}
                  className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh logs"
                >
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {logs.map((log, idx) => (
            <tr key={idx}>
              <td className="px-4 py-2 whitespace-nowrap font-mono text-xs align-top">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
              <td className="px-4 py-2 whitespace-pre-wrap text-xs">{log.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 