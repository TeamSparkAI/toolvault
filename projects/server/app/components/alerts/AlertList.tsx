import React, { useState } from 'react';
import { AlertReadData } from '@/lib/models/types/alert';
import { Dimensions, Dimension } from '@/app/hooks/useDimensions';
import { getClientIcon } from '@/lib/client-icons';
import { getSeverityLevel } from '@/lib/severity';
import { AlertFilter } from '@/lib/models/types/alert';
import { useRouter } from 'next/navigation';

interface AlertListProps {
  alerts: AlertReadData[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  initialFilters?: Partial<AlertFilter>;
  dimensions: Dimensions;
}

export function AlertList({
  alerts,
  isLoading,
  hasMore,
  onLoadMore,
  initialFilters = {}, 
  dimensions
}: AlertListProps) {
  const [expandedAlertId, setExpandedAlertId] = useState<number | null>(null);
  const router = useRouter();

  if (isLoading && alerts.length === 0) {
    return <p className="text-gray-500">Loading alerts...</p>;
  }

  if (!alerts || alerts.length === 0) {
    return <p className="text-gray-500">No alerts found</p>;
  }

  const toggleExpand = (alertId: number) => {
    setExpandedAlertId(expandedAlertId === alertId ? null : alertId);
  };

  const navigateToMessage = (messageId: number, alertId: number) => {
    router.push(`/messages/${messageId}?alert=${alertId}`);
  };

  const getDimensionLabel = (dimension: string, value: string) => {
    return dimensions.getLabel(dimension as Dimension, value) || value;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Severity
            </th>
            {!('policyId' in initialFilters) && (
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Policy
              </th>
            )}
            {!('conditionName' in initialFilters) && (
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Condition
              </th>
            )}
            {!('serverId' in initialFilters) && (
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Server
              </th>
            )}
            {!('clientId' in initialFilters) && (
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Client
              </th>
            )}
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {alerts.map((alert) => (
            <React.Fragment key={alert.alertId}>
              <tr 
                onClick={() => navigateToMessage(alert.messageId, alert.alertId)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {!alert.seenAt ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      New
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Seen
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex items-center space-x-2">
                    {getSeverityLevel(alert.policySeverity).icon}
                    <span className="font-medium">{alert.policySeverity}</span>
                    <span>-</span>
                    <span>{getSeverityLevel(alert.policySeverity).name}</span>
                  </div>
                </td>
                {!('policyId' in initialFilters) && (
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getDimensionLabel('policyId', String(alert.policyId))}
                  </td>
                )}
                {!('conditionName' in initialFilters) && (
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {alert.condition.name}
                  </td>
                )}
                {!('serverId' in initialFilters) && (
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getDimensionLabel('serverId', String(alert.serverId))}
                  </td>
                )}
                {!('clientId' in initialFilters) && (
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center space-x-2">
                      {alert.clientType && (
                        <img 
                          src={getClientIcon(alert.clientType)} 
                          alt={`${alert.clientType} icon`} 
                          className="w-5 h-5"
                        />
                      )}
                      <span>{getDimensionLabel('clientId', String(alert.clientId))}</span>
                    </div>
                  </td>
                )}
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(alert.createdAt).toLocaleString()}
                </td>
              </tr>
              {expandedAlertId === alert.alertId && (
                <tr>
                  <td colSpan={7} className="px-4 py-4 bg-gray-50">
                    <div className="text-sm text-gray-900">
                      <div className="font-medium mb-2">Alert Details</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p><span className="font-medium">Message ID:</span> {alert.messageId}</p>
                          <p><span className="font-medium">Policy ID:</span> {alert.policyId}</p>
                          <p><span className="font-medium">Condition:</span> {alert.condition.name}</p>
                        </div>
                        <div>
                          <p><span className="font-medium">Created:</span> {new Date(alert.createdAt).toLocaleString()}</p>
                          <p><span className="font-medium">Server:</span> {getDimensionLabel('serverId', String(alert.serverId))}</p>
                          <p><span className="font-medium">Client:</span> {getDimensionLabel('clientId', String(alert.clientId))}</p>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      
      {isLoading && alerts.length > 0 && (
        <div className="text-center py-4">
          <p className="text-gray-500">Loading more alerts...</p>
        </div>
      )}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
} 