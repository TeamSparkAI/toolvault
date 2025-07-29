'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { MessageData } from '@/lib/models/types/message';
import { AlertReadData } from '@/lib/models/types/alert';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { getSeverityLevel } from '@/lib/severity';
import { useDimensions } from '@/app/hooks/useDimensions';
import { useLayout } from '@/app/contexts/LayoutContext';
import { useAlerts } from '@/app/contexts/AlertsContext';
import { getClientIcon } from '@/lib/client-icons';
import { applyMatchesFromAlerts } from '@/lib/utils/matches';
import { getServerIconUrl } from '@/lib/utils/githubImageUrl';
import { Server } from '@/lib/types/server';
import { AlertsMenu } from '@/app/components/alerts/AlertsMenu';
import { log } from '@/lib/logging/console';

export default function MessageDetailsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const messageId = params.messageId as string;
  const [message, setMessage] = useState<MessageData | null>(null);
  const [alerts, setAlerts] = useState<AlertReadData[]>([]);
  const [server, setServer] = useState<Server | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const { dimensions } = useDimensions({
    dimensions: ['serverId', 'clientId', 'policyId'],
    autoFetch: true
  });
  const { setHeaderTitle } = useLayout();
  const { refreshUnseenAlerts } = useAlerts();

  useEffect(() => {
    if (message) {
      setHeaderTitle(`Message (${messageId})`);
    }
    return () => setHeaderTitle(undefined);
  }, [message, messageId, setHeaderTitle]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [messageResponse, alertsResponse] = await Promise.all([
          fetch(`/api/v1/messages/${messageId}`).then(r => r.json()),
          fetch(`/api/v1/alerts?messageId=${messageId}`).then(r => r.json())
        ]);

        const messageData = new JsonResponseFetch<MessageData>(messageResponse, 'message');
        const alertsData = new JsonResponseFetch<AlertReadData[]>(alertsResponse, 'alerts');
        
        log.debug('messageData', messageData);

        if (messageData.isSuccess()) {
          setMessage(messageData.payload);
          
          // Fetch server data if we have a serverId
          if (messageData.payload.serverId) {
            try {
              const serverResponse = await fetch(`/api/v1/servers/${messageData.payload.serverId}`);
              if (serverResponse.ok) {
                const serverData = await serverResponse.json();
                const serverDataResponse = new JsonResponseFetch<Server>(serverData, 'server');
                if (serverDataResponse.isSuccess()) {
                  setServer(serverDataResponse.payload);
                }
              }
            } catch (error) {
              log.error('[MessageDetails] Error fetching server data:', error);
            }
          }
        }

        if (alertsData.isSuccess()) {
          setAlerts(alertsData.payload);
          
          // Check if there are any unseen alerts and mark them as seen
          const unseenAlerts = alertsData.payload.filter(alert => !alert.seenAt);
          if (unseenAlerts.length > 0) {
            // Mark all alerts for this message as seen
            try {
              const markResponse = await fetch('/api/v1/alerts/mark-all', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                  seen: true, 
                  messageId: parseInt(messageId) 
                }),
              });
              
              if (markResponse.ok) {
                // Update the alerts state to reflect the seen status
                setAlerts(alertsData.payload.map(alert => ({
                  ...alert,
                  seenAt: alert.seenAt || new Date().toISOString()
                })));
                
                // Refresh the unseen alerts context to update other components
                await refreshUnseenAlerts();
              }
            } catch (error) {
              log.error('[MessageDetails] Error marking alerts as seen:', error);
            }
          }
          
          // Set the selected alert from URL parameter if it exists
          const alertId = searchParams.get('alert');
          if (alertId) {
            const alertIdNum = parseInt(alertId);
            if (!isNaN(alertIdNum) && alertsData.payload.some(a => a.alertId === alertIdNum)) {
              setSelectedAlertId(alertIdNum);
            }
          }
        }
      } catch (error) {
        log.error('[MessageDetails] Error fetching message details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [messageId, searchParams]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!message) {
    return <div>Message not found</div>;
  }

  const getClientName = (clientId: string | undefined) => {
    if (!clientId) return '-';
    return dimensions.getLabel('clientId', clientId) || clientId;
  };

  const getHighlightedRedactedPayload = (payload: any, alerts: AlertReadData[], origin: 'client' | 'server', selectedAlert: AlertReadData | null) => {
    const formattedPayload = JSON.stringify(payload, null, 2);
    if (!alerts || alerts.length === 0) {
      return formattedPayload;
    }
    
    const filteredAlerts = alerts.filter(a => a.origin === origin);
    
    if (filteredAlerts.length === 0) {
      return formattedPayload;
    }
    
    const result = applyMatchesFromAlerts(formattedPayload, filteredAlerts);
    log.info('result', result);
    
    try {      
      // If we have a selected alert, highlight its redactions
      if (selectedAlert && selectedAlert.origin === origin) {
        const selectedAlertRedactions = result.appliedMatches.filter(r => r.alertId === selectedAlert.alertId);
        
        if (selectedAlertRedactions.length > 0) {
          // Sort redactions by final position in reverse order to avoid position shifts
          const sortedRedactions = [...selectedAlertRedactions].sort((a, b) => b.finalStart - a.finalStart);
          
          let highlightedString = result.processedText;
          let offset = 0;
          
          for (const redaction of sortedRedactions) {
            // Find the corresponding position in the formatted JSON
            let formattedStart = redaction.finalStart;
            let formattedEnd = redaction.finalEnd;
            
            if (formattedStart !== -1 && formattedEnd !== -1) {
              const before = highlightedString.substring(0, formattedStart + offset);
              const replacement = highlightedString.substring(formattedStart + offset, formattedEnd + offset);
              const after = highlightedString.substring(formattedEnd + offset);
              highlightedString = `${before}<mark class="bg-red-200 text-red-800 px-1 rounded">${replacement}</mark>${after}`;
              offset += '<mark class="bg-red-200 text-red-800 px-1 rounded"></mark>'.length;
            }
          }
          
          log.info('highlightedString', highlightedString);
          return highlightedString;
        }
      }
      log.info('result.processedText', result.processedText);
      return result.processedText;
    } catch (error) {
      log.error('error', error);
      return formattedPayload;
    }
  };

  const highlightMatchedText = (payload: any, alert: AlertReadData | null) => {4
    // First format the JSON with proper indentation
    const formattedPayload = JSON.stringify(payload, null, 2);

    if (!alert || !alert.matches || alert.matches.length === 0) {
      return formattedPayload;
    }

    const result = applyMatchesFromAlerts(formattedPayload, [alert]);
        
    // Sort redactions by start position in reverse order to avoid position shifts
    const sortedMatches = [...result.appliedMatches].sort((a, b) => b.originalEnd - a.originalStart);

    let highlightedString = formattedPayload;
    let offset = 0;

    for (const match of sortedMatches) {
      // Find the corresponding position in the formatted JSON
      let formattedStart = match.originalStart;
      let formattedEnd = match.originalEnd;
      
      if (formattedStart !== -1 && formattedEnd !== -1) {
        const before = highlightedString.substring(0, formattedStart + offset);
        const match = highlightedString.substring(formattedStart + offset, formattedEnd + offset);
        const after = highlightedString.substring(formattedEnd + offset);
        highlightedString = `${before}<mark class="bg-yellow-200">${match}</mark>${after}`;
        offset += '<mark class="bg-yellow-200"></mark>'.length;
      }
    }

    return highlightedString;
  };

  const getFriendlyActionName = (action: string) => {
    switch (action) {
      case 'replace':
        return 'Replace';
      case 'redact':
      case 'redactPattern':
        return 'Redact';
      case 'remove':
        return 'Remove';
      case 'none':
        return 'None';
      default:
        return action;
    }
  };

  const refreshAlerts = async () => {
    try {
      const alertsResponse = await fetch(`/api/v1/alerts?messageId=${messageId}`);
      const alertsData = new JsonResponseFetch<AlertReadData[]>(await alertsResponse.json(), 'alerts');
      if (alertsData.isSuccess()) {
        setAlerts(alertsData.payload);
      }
    } catch (error) {
      log.error('[MessageDetails] Error refreshing alerts:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Message Details */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex-shrink-0">
        {/* First line: Client <--> Server with timestamp */}
        <div className="flex items-center justify-between text-lg font-bold mb-4">
          <div className="flex items-center gap-2">
            <span>Client:</span>
            <img
              src={getClientIcon(message.clientType || 'generic')}
              alt={`${message.clientType || 'generic'} icon`}
              className="w-6 h-6"
            />
            <a href={`/clients/${message.clientId}`} className="text-blue-600 hover:underline">
              {message.clientId ? dimensions.getLabel('clientId', message.clientId.toString()) || `Client ${message.clientId}` : 'Unknown'}
            </a>
            <svg 
              className="w-8 h-8 mx-2 text-gray-400" 
              viewBox="0 0 32 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              {message.origin === 'server' ? (
                // Arrow pointing left (server -> client)
                <>
                  <path d="M4 12h24" />
                  <path d="M8 8l-4 4 4 4" />
                </>
              ) : message.origin === 'client' && !message.timestampResult ? (
                // Arrow pointing right (client -> server, no response yet)
                <>
                  <path d="M4 12h24" />
                  <path d="M24 8l4 4-4 4" />
                </>
              ) : (
                // Bidirectional arrow (default case)
                <>
                  <path d="M4 12h24" />
                  <path d="M8 8l-4 4 4 4" />
                  <path d="M24 8l4 4-4 4" />
                </>
              )}
            </svg>
            <span>Server:</span>
            <img
              src={getServerIconUrl(server)}
              alt="MCP icon"
              className="w-6 h-6"
            />
            <a href={`/servers/${message.serverId}`} className="text-blue-600 hover:underline">
              {server?.name || message.serverName}
            </a>
          </div>
          <span>{new Date(message.timestamp).toLocaleString()}</span>
        </div>

        {/* Details Grid */}
        <div className="flex gap-4 md:gap-8 lg:gap-12">
          {/* Method */}
          <div>
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Method</div>
            <div className="text-base">{message.payloadMethod}</div>
          </div>

          {/* Tool */}
          {message.payloadToolName && (
            <div>
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Tool</div>
              <div className="text-base">{message.payloadToolName}</div>
            </div>
          )}

          {/* Session ID */}
          <div>
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">MCP Session ID</div>
            <div className="text-base font-mono">{message.sessionId}</div>
          </div>

          {/* Message ID */}
          {message.payloadMessageId && (
            <div>
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">MCP Message ID</div>
              <div className="text-base font-mono">{message.payloadMessageId}</div>
            </div>
          )}

          {/* User */}
          <div>
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">User</div>
            <div className="text-base">{message.userId}</div>
          </div>

          {/* Source IP */}
          <div>
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Source IP</div>
            <div className="text-base">{message.sourceIP}</div>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-4 flex-shrink-0">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Alerts</h2>
              <AlertsMenu onRefresh={refreshAlerts} currentFilters={{ messageId: parseInt(messageId) }} initialFilters={{}} showFilteredText={false} menuPosition="left" />
            </div>
            <p className="text-sm text-gray-500">Select filter to highlight match in payload</p>
          </div>
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
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Policy
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Matched Filter
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Matches
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {alerts.map(alert => (
                  <tr 
                    key={alert.alertId}
                    className={`cursor-pointer transition-colors ${
                      selectedAlertId === alert.alertId 
                        ? 'bg-blue-50 hover:bg-blue-100' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      setSelectedAlertId(selectedAlertId === alert.alertId ? null : alert.alertId);
                    }}
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
                        <span className={`px-2 py-1 rounded ${getSeverityLevel(alert.policySeverity).color}`}>
                          {getSeverityLevel(alert.policySeverity).icon}
                        </span>
                        <span className="font-medium">{alert.policySeverity}</span>
                        <span>-</span>
                        <span>{getSeverityLevel(alert.policySeverity).name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <a 
                        href={`/policies/${alert.policyId}`} 
                        className="text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()} // Prevent row selection when clicking the link
                      >
                        {dimensions.getLabel('policyId', alert.policyId.toString()) || `Policy ${alert.policyId}`}
                      </a>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {alert.filterName}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {alert.matches && alert.matches.length > 0 ? (
                        getFriendlyActionName(alert.matches[0].action)
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {alert.matches ? alert.matches.length : 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Errors Section */}
      {message.payloadError && (
        <div className="bg-white rounded-lg shadow p-4 mb-4 flex-shrink-0">
          <div className="mb-2">
            <h2 className="text-xl font-semibold text-red-600">Errors</h2>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-red-800">
                  Error Code: {message.payloadError.code}
                </div>
                <div className="mt-1 text-sm text-red-700">
                  {message.payloadError.message}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payloads Section */}
      <div className="bg-white rounded-lg shadow p-4 flex-1 flex flex-col min-h-96">
        <h2 className="text-xl font-semibold mb-2 flex-shrink-0">Message Payloads</h2>
        
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Request Payloads */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-2 font-mono">params</h3>
            
            {/* Check if any client-side actions were applied */}
            {(() => {
              const clientAlerts = alerts.filter(a => a.origin === 'client');
              const hasActions = clientAlerts.some(alert => 
                alert.matches && alert.matches.some(match => match.action !== 'none')
              );
              
              return (
                <>
                  {/* Original Request Payload */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-600 mb-1">
                      {message.origin === 'server' 
                        ? (hasActions ? 'Sent by server' : 'Sent by server and delivered to client')
                        : (hasActions ? 'Sent by client' : 'Sent by client and delivered to server')
                      }
                    </h4>
                    {message.payloadParams === null ? (
                      <div className="text-gray-500 italic">No params provided</div>
                    ) : (
                      <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
                        <div dangerouslySetInnerHTML={{ 
                          __html: highlightMatchedText(
                            message.payloadParams, 
                            alerts.find(a => a.alertId === selectedAlertId && a.origin === 'client') || null
                          ) 
                        }} />
                      </pre>
                    )}
                  </div>

                  {/* Final Request Payload - only show if actions were applied */}
                  {hasActions && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-600 mb-1">
                        {message.origin === 'server' 
                          ? 'Delivered to client (with actions applied)'
                          : 'Delivered to server (with actions applied)'
                        }
                      </h4>
                      {message.payloadParams === null ? (
                        <div className="text-gray-500 italic">No params provided</div>
                      ) : (
                        <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
                          <div dangerouslySetInnerHTML={{ 
                            __html: getHighlightedRedactedPayload(message.payloadParams, alerts, 'client', alerts.find(a => a.alertId === selectedAlertId && a.origin === 'client') || null)
                          }} />
                        </pre>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Response Payloads */}
          {message.timestampResult && (
            <div className="mb-4">
              <h3 className="text-xl font-semibold mb-2 font-mono">result</h3>
              
              {message.payloadResult === null ? (
                <div className="text-gray-500 italic">No result provided</div>
              ) : (
                /* Check if any server-side actions were applied */
                (() => {
                  const serverAlerts = alerts.filter(a => a.origin === 'server');
                  const hasActions = serverAlerts.some(alert => 
                    alert.matches && alert.matches.some(match => match.action !== 'none')
                  );
                  
                  return (
                    <>
                      {/* Original Response Payload */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-600 mb-1">
                          {hasActions ? 'Sent by server' : 'Sent by server and delivered to client'}
                        </h4>
                        <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
                          <div dangerouslySetInnerHTML={{ 
                            __html: highlightMatchedText(
                              message.payloadResult, 
                              alerts.find(a => a.alertId === selectedAlertId && a.origin === 'server') || null
                            ) 
                          }} />
                        </pre>
                      </div>

                      {/* Final Response Payload - only show if actions were applied */}
                      {hasActions && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-600 mb-1">Delivered to client (with actions applied)</h4>
                          <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
                            <div dangerouslySetInnerHTML={{ 
                              __html: getHighlightedRedactedPayload(message.payloadResult, alerts, 'server', alerts.find(a => a.alertId === selectedAlertId && a.origin === 'server') || null)
                            }} />
                          </pre>
                        </div>
                      )}
                    </>
                  );
                })()
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 