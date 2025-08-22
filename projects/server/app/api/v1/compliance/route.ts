import { NextResponse } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
import { ClientData } from '@/lib/models/types/client';
import { ServerData } from '@/lib/models/types/server';
import { ClientServerData } from '@/lib/models/types/clientServer';
import { ClientType } from '@/lib/types/clientType';
import { logger } from '@/lib/logging/server';
import { PackageExtractionService } from '@/lib/services/packageExtractionService';

export const dynamic = 'force-dynamic';

export interface ClientComplianceData {
  clientId: number;
  name: string;
  type: ClientType;
  enabled: boolean;
  autoUpdate: boolean;
  isLinked: boolean;
  lastScannedAt: string | null;
  hasPendingOperations: boolean;
  hasUnmanagedServers: boolean;
  hasNonSecureServers: boolean;
  hasUnpinnedPinnableServers: boolean;
}

export interface ComplianceData {
  systemCompliance: {
    requireClientToken: boolean;
    strictServerAccess: boolean;
  };
  clientCompliance: ClientComplianceData[];
}

export async function GET(): Promise<NextResponse> {
  try {
    const modelFactory = ModelFactory.getInstance();
    
    // Get app settings
    const appSettingsModel = await modelFactory.getAppSettingsModel();
    const appSettings = await appSettingsModel.get();
    
    // Get all clients
    const clientModel = await modelFactory.getClientModel();
    const allClients = await clientModel.list();
    // Filter out clients that are not enabled and the ttv client (built-in test client)
    const clients = allClients.filter((client: ClientData) => client.enabled && client.type !== "ttv");
    
    // Get all servers
    const serverModel = await modelFactory.getServerModel();
    const serversResult = await serverModel.list({}, { limit: 1000, sort: 'asc' });
    const servers = serversResult.servers;
    
    // Get all client-server relationships
    const clientServerModel = await modelFactory.getClientServerModel();
    const clientServers = await clientServerModel.list({});
    
    // Create a map of server security by serverId for quick lookup
    const serverSecurityMap = new Map<number, string | null>();
    servers.forEach((server: ServerData) => {
      serverSecurityMap.set(server.serverId, server.security || null);
    });
    
    // Create a map of client-server relationships by clientId for quick lookup
    const clientServerMap = new Map<number, ClientServerData[]>();
    clientServers.forEach((cs: ClientServerData) => {
      if (!clientServerMap.has(cs.clientId)) {
        clientServerMap.set(cs.clientId, []);
      }
      clientServerMap.get(cs.clientId)!.push(cs);
    });
    
    // Compute client compliance data
    const clientCompliance: ClientComplianceData[] = clients.map((client: ClientData) => {
      const clientRelationships = clientServerMap.get(client.clientId) || [];
      
      // Check for pending operations
      const hasPendingOperations = clientRelationships.some(cs => 
        cs.syncState === 'add' || cs.syncState === 'deleteScanned' || cs.syncState === 'deletePushed' || cs.serverId === null
      );
      
      // Check for unmanaged servers (security === 'unmanaged')
      const hasUnmanagedServers = clientRelationships.some(cs => {
        if (!cs.serverId) return false;
        const serverSecurity = serverSecurityMap.get(cs.serverId);
        return serverSecurity === 'unmanaged';
      });
      
      // Check for non-secure servers (security === null)
      const hasNonSecureServers = clientRelationships.some(cs => {
        if (!cs.serverId) return false;
        const serverSecurity = serverSecurityMap.get(cs.serverId);
        return serverSecurity === null;
      });
      
      // Check for unpinned pinnable servers
      const hasUnpinnedPinnableServers = clientRelationships.some(cs => {
        if (!cs.serverId) return false;
        const server = servers.find(s => s.serverId === cs.serverId);
        if (!server) return false;
        
        const analysis = PackageExtractionService.analyzeServerConfig(server.config);
        return analysis.isPinnable && !analysis.isPinned;
      });
      
      return {
        clientId: client.clientId,
        name: client.name,
        type: client.type,
        enabled: client.enabled,
        autoUpdate: client.autoUpdate || false,
        isLinked: !!client.configPath,
        lastScannedAt: client.lastScanned || null,
        hasPendingOperations,
        hasUnmanagedServers,
        hasNonSecureServers,
        hasUnpinnedPinnableServers,
      };
    });
    
    const complianceData: ComplianceData = {
      systemCompliance: {
        requireClientToken: appSettings.requireClientToken || false,
        strictServerAccess: appSettings.strictServerAccess || false,
      },
      clientCompliance,
    };
    
    return JsonResponse.payloadResponse('compliance', complianceData);
  } catch (error) {
    logger.error('Error computing compliance data:', error);
    return JsonResponse.errorResponse(500, 'Failed to compute compliance data');
  }
} 