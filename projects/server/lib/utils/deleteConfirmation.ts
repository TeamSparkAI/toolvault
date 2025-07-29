import { log } from '@/lib/logging/console';

export interface DeleteConfirmationInfo {
  // For servers
  clientCount?: number;
  serverAlertCount?: number;
  serverMessageCount?: number;
  
  // For clients
  serverCount?: number;
  clientAlertCount?: number;
  clientMessageCount?: number;
  
  // Common
  hasAlerts: boolean;
  hasMessages: boolean;
  hasRelationships: boolean;
}

export interface DeleteConfirmationMessage {
  title: string;
  message: string;
  severity: 'warning' | 'danger';
  recommendDisable: boolean;
}

export async function getServerDeleteInfo(serverId: number): Promise<DeleteConfirmationInfo> {
  try {
    const [clientsResponse, alertsResponse, messagesResponse] = await Promise.all([
      fetch(`/api/v1/servers/${serverId}/clients`),
      fetch(`/api/v1/alerts?serverId=${serverId}&limit=1`),
      fetch(`/api/v1/messages?serverId=${serverId}&limit=1`)
    ]);

    const clientCount = clientsResponse.ok ? 
      (await clientsResponse.json()).relationships?.length || 0 : 0;
    
    const alertCount = alertsResponse.ok ? 
      (await alertsResponse.json()).pagination?.total || 0 : 0;
    
    const messageCount = messagesResponse.ok ? 
      (await messagesResponse.json()).pagination?.total || 0 : 0;

    return {
      clientCount,
      serverAlertCount: alertCount,
      serverMessageCount: messageCount,
      hasAlerts: alertCount > 0,
      hasMessages: messageCount > 0,
      hasRelationships: clientCount > 0
    };
  } catch (error) {
    log.error('Error gathering server delete info:', error);
    return {
      hasAlerts: false,
      hasMessages: false,
      hasRelationships: false
    };
  }
}

export async function getClientDeleteInfo(clientId: number): Promise<DeleteConfirmationInfo> {
  try {
    const [serversResponse, alertsResponse, messagesResponse] = await Promise.all([
      fetch(`/api/v1/clients/${clientId}/servers`),
      fetch(`/api/v1/alerts?clientId=${clientId}&limit=1`),
      fetch(`/api/v1/messages?clientId=${clientId}&limit=1`)
    ]);

    const serverCount = serversResponse.ok ? 
      (await serversResponse.json()).relationships?.length || 0 : 0;
    
    const alertCount = alertsResponse.ok ? 
      (await alertsResponse.json()).pagination?.total || 0 : 0;
    
    const messageCount = messagesResponse.ok ? 
      (await messagesResponse.json()).pagination?.total || 0 : 0;

    return {
      serverCount,
      clientAlertCount: alertCount,
      clientMessageCount: messageCount,
      hasAlerts: alertCount > 0,
      hasMessages: messageCount > 0,
      hasRelationships: serverCount > 0
    };
  } catch (error) {
    log.error('Error gathering client delete info:', error);
    return {
      hasAlerts: false,
      hasMessages: false,
      hasRelationships: false
    };
  }
}

export function buildServerDeleteMessage(
  serverName: string, 
  info: DeleteConfirmationInfo
): DeleteConfirmationMessage {
  const parts: string[] = [];
  let severity: 'warning' | 'danger' = 'warning';
  let recommendDisable = false;

  // Base message
  parts.push(`Are you sure you want to delete server "${serverName}"?`);

  // Check for client relationships
  if (info.hasRelationships && info.clientCount) {
    parts.push(`\n• This server is in use by ${info.clientCount} client${info.clientCount > 1 ? 's' : ''}.`);
    severity = 'danger';
    recommendDisable = true;
  }

  // Check for alerts and messages
  if (info.hasAlerts || info.hasMessages) {
    const alertText = info.hasAlerts ? `${info.serverAlertCount} alert${info.serverAlertCount !== 1 ? 's' : ''}` : '';
    const messageText = info.hasMessages ? `${info.serverMessageCount} message${info.serverMessageCount !== 1 ? 's' : ''}` : '';
    const combinedText = [alertText, messageText].filter(Boolean).join(' and ');
    
    parts.push(`\n• This server is referenced by ${combinedText}, and deleting it will remove the server information from them.`);
    severity = 'danger';
    recommendDisable = true;
  }

  // Recommendation
  if (recommendDisable) {
    parts.push(`\nYou may want to consider disabling the server instead to preserve this information.`);
  }

  return {
    title: 'Delete Server',
    message: parts.join(''),
    severity,
    recommendDisable
  };
}

export function buildClientDeleteMessage(
  clientName: string, 
  info: DeleteConfirmationInfo
): DeleteConfirmationMessage {
  const parts: string[] = [];
  let severity: 'warning' | 'danger' = 'warning';
  let recommendDisable = false;

  // Base message
  parts.push(`Are you sure you want to delete client "${clientName}"?`);

  // Do NOT warn about server relationships for clients
  // Only warn if referenced by alerts or messages
  if (info.hasAlerts || info.hasMessages) {
    const alertText = info.hasAlerts ? `${info.clientAlertCount} alert${info.clientAlertCount !== 1 ? 's' : ''}` : '';
    const messageText = info.hasMessages ? `${info.clientMessageCount} message${info.clientMessageCount !== 1 ? 's' : ''}` : '';
    const combinedText = [alertText, messageText].filter(Boolean).join(' and ');
    
    parts.push(`\n• This client is referenced by ${combinedText}, and deleting it will remove the client information from them.`);
    severity = 'danger';
    recommendDisable = true;
  }

  // Recommendation
  if (recommendDisable) {
    parts.push(`\nYou may want to consider disabling the client instead to preserve this information.`);
  }

  return {
    title: 'Delete Client',
    message: parts.join(''),
    severity,
    recommendDisable
  };
} 