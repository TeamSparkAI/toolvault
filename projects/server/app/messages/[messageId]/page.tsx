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
import { applyModificationsToPayload, resolveFindings } from '@/lib/policy-engine/utils/messageModifications';
import { MessageActionsData } from '@/lib/models/types/messageAction';
import { MessageOrigin } from '@/lib/jsonrpc';
import { AppliedFieldModification, isAppliedFieldModification, isAppliedMessageReplacement } from '@/lib/policy-engine/types/core';
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
  const [messageActions, setMessageActions] = useState<MessageActionsData | null>(null);
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
        const [messageResponse, alertsResponse, messageActionsResponse] = await Promise.all([
          fetch(`/api/v1/messages/${messageId}`).then(r => r.json()),
          fetch(`/api/v1/alerts?messageId=${messageId}`).then(r => r.json()),
          fetch(`/api/v1/messageActions/${messageId}`).then(r => r.json())
        ]);

        const messageData = new JsonResponseFetch<MessageData>(messageResponse, 'message');
        const alertsData = new JsonResponseFetch<AlertReadData[]>(alertsResponse, 'alerts');
        const messageActionsData = new JsonResponseFetch<MessageActionsData | null>(messageActionsResponse, 'messageAction');
        
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

        // Handle message actions
        if (messageActionsData.isSuccess()) {
          setMessageActions(messageActionsData.payload);
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

  // The selection context can be an alertId or a messageActionId.  If alertId, we highlight any ActionEvent content modifications for that alertId.
  // If messageActionId, we highlight any ActionEvent content modifications for that messageActionId.  Right now we only have alerts displayed and
  // the expected functionality is implemented.  When we add an actions list, we'll need to implement the functionality for that as well (as below).
  //
  // !!! If I select an Alert I want to see the alert matches highlighted in the original message, whether or not there were any content mods.  If
  //     there were content mods related to that alert, I also want to see them highlighted in the modified message [done].
  //
  // !!! If I select a MessageAction I want to see the message action matches (if applicable) highlighted in the original message, whether or not there
  //     were any content mods.  If there were content mods related to that message action, I want to see them highlighted in the modified message.
  //
  // !!! We need to highlight both the original payload and the modified payload with the appropriate matches.  The rule is: if an alert is selected,
  //     we highlight the alert findings in the original message using the highlightMatchedText method, which guarantees that all alert findings will be
  //     highlighted (whether or not there were any content mods).  And then we use this method to generate the modified payload with any content mods
  //     highlighted in the modified payload (in this case the UX gets the original payload from the highlightMatchedText method and ignores the original
  //     payload from this method).  If no alert is selected, we use this method to generate the original and modified payload, and if a messageAction is
  //     selected, it will also highlight the action event content modifications in the original message and the modified message (still to be implemented).
  //
  const getHighlightedRedactedPayload = (payload: any, origin: MessageOrigin, messageActions: MessageActionsData, selectedAlertId: number | null) => {
    const formattedPayload = JSON.stringify(payload, null, 2);
    if (!messageActions) {
      return formattedPayload;
    }

    const messagActionsForOrigin = messageActions.actions.filter(a => a.origin === origin);
    const contentModificationMessageActions = messagActionsForOrigin.filter(a => a.actionEvents.some(e => e.contentModification));
    if (contentModificationMessageActions.length === 0) {
      return formattedPayload;
    }

    // Apply modifications to the payload
    const { originalPayload, modifiedPayload } = applyModificationsToPayload(payload, origin, contentModificationMessageActions);

    // If any mods applied and there is a selection context, highlight the selected content's mods
    if (modifiedPayload && selectedAlertId != null) {
      // There will either be a single message replacement, or one or more field modifications
      const appliedMessageReplacementEvent = contentModificationMessageActions.find(a =>
        a.actionEvents.some(e => 
          e.alertId === selectedAlertId && 
          e.contentModification?.type === 'message' &&
          isAppliedMessageReplacement(e.contentModification) &&
          e.contentModification.applied
        )
      );

      const appliedFieldModEvents = contentModificationMessageActions.flatMap(a => 
        a.actionEvents.filter(e => 
          e.alertId === selectedAlertId && 
          e.contentModification?.type === 'field' && 
          isAppliedFieldModification(e.contentModification) && 
          e.contentModification.applied
        )
      );

      if (appliedMessageReplacementEvent) {
        // Highlight the message payload (which as been replaced)
      } else if (appliedFieldModEvents.length > 0) {
        // Highlight the field modifications

        // Sort redactions by final position in reverse order to avoid position shifts
        const sortedModifcations = [...appliedFieldModEvents].sort((a, b) => (b.contentModification as AppliedFieldModification).jsonResultStart! - (a.contentModification! as AppliedFieldModification).jsonResultStart!);
          
        let highlightedString = modifiedPayload;
        let offset = 0;
        
        for (const modification of sortedModifcations) {
          // Find the corresponding position in the formatted JSON
          const contentModification = modification.contentModification as AppliedFieldModification;
          let formattedStart = contentModification.jsonResultStart!;
          let formattedEnd = contentModification.jsonResultEnd!;
          
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

    return modifiedPayload || originalPayload;
  };

  const highlightMatchedText = (payload: any, alert: AlertReadData | null) => {
    // First format the JSON with proper indentation
    const formattedPayload = JSON.stringify(payload, null, 2);

    if (!alert || !alert.findings || alert.findings.length === 0) {
      return formattedPayload;
    }

    const resolvedFindings = resolveFindings(formattedPayload, alert.findings);

    // Sort findings by start position in reverse order to avoid position shifts
    const sortedFindings = [...resolvedFindings].sort((a, b) => b.resolvedStart - a.resolvedStart);

    let highlightedString = formattedPayload;
    let offset = 0;

    for (const finding of sortedFindings) {
      // Find the corresponding position in the formatted JSON
      let formattedStart = finding.resolvedStart;
      let formattedEnd = finding.resolvedEnd;
      
      if (formattedStart !== -1 && formattedEnd !== -1) {
        const before = highlightedString.substring(0, formattedStart + offset);
        const finding = highlightedString.substring(formattedStart + offset, formattedEnd + offset);
        const after = highlightedString.substring(formattedEnd + offset);
        highlightedString = `${before}<mark class="bg-yellow-200">${finding}</mark>${after}`;
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
                    Condition
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
                      {alert.condition.name}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {alert.matches && alert.matches.length > 0 ? (
                        getFriendlyActionName(alert.matches[0].action)
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {alert.findings ? alert.findings.length : 0}
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
              // !!! We need to see if the selectedAlert has a corresponding content modification action, and if so, pass that to getHighlightedRedactedPayload
              // !!! There could theoretically be multiple content modification actions for a given alert - LATER
              // !!! We will have a list of actions also, and if one of those is selected, then that's the focussed action (duh)
              const hasActions = messageActions && messageActions.actions.some(action => 
                action.origin === 'client' && action.actionEvents.some(event => event.contentModification)
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
                            __html: getHighlightedRedactedPayload(message.payloadParams, 'client', messageActions!, selectedAlertId)
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
                  const hasActions = messageActions && messageActions.actions.some(action => 
                    action.origin === 'server' && action.actionEvents.some(event => event.contentModification)
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
                              __html: getHighlightedRedactedPayload(message.payloadResult, 'server', messageActions!, selectedAlertId)
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