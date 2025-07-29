import { NextRequest } from 'next/server';
import { createProxyToken, ProxyJwtPayload } from '@/lib/proxyJwt';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { ValidationService } from '@/lib/services/validationService';
import { BridgeManager } from '@/lib/bridge/BridgeManager';
import { logger } from '@/lib/logging/server';

export async function POST(request: NextRequest) {
    try {
        const { user, args } = await request.json();

        if (!user) {
            return JsonResponse.errorResponse(400, 'User information is required');
        }

        if (!args || !Array.isArray(args) || args.length < 1) {
            return JsonResponse.errorResponse(400, 'At least one arg value is required');
        }

        // Parse the first arg to get server token
        let serverToken: string;

        if (typeof args[0] === 'string') {
            // The first arg is the server token, or server name and server token separated by a slash
            const parts = args[0].split("/");
            if (parts.length > 1) {
                serverToken = parts[1];
            } else {
                serverToken = parts[0];
            }
        } else {
            return JsonResponse.errorResponse(400, 'First arg must be a string');
        }

        // Get client token from second arg if provided
        const clientToken = args.length > 1 ? args[1] : undefined;

        // Use the shared validation service
        const validationService = ValidationService.getInstance();
        const validationResult = await validationService.validate({serverToken, clientToken});

        if (!validationResult.success) {
            return JsonResponse.errorResponse(400, validationResult.error || 'Validation failed');
        }

        const bridgeManager = BridgeManager.getInstance();
        const status = await bridgeManager.getStatus();
        if (!status.running) {
            return JsonResponse.errorResponse(503, 'MCP gateway is not running, server configuration is not available');
        }

        // Create JWT payload
        const payload: ProxyJwtPayload = {
            user,
            sourceIp: request.headers.get('x-forwarded-for') || request.ip || 'unknown',
            serverToken: validationResult.server!.token,
            serverName: validationResult.server!.name,
            serverId: validationResult.server!.serverId,
            clientId: validationResult.client?.clientId || null
        };

        // Sign JWT
        const token = createProxyToken(payload);

        const serverModel = await ModelFactory.getInstance().getServerModel();
        const mcpProxyServerConfig = await serverModel.getMcpServerConfigForProxy(validationResult.server!.token, token);

        // We're adding the server updatedAt so that a client can check if the server has been updated since it last got a config
        return JsonResponse.payloadsResponse([
            { key: 'token', payload: token },
            { key: 'config', payload: { 
                ...mcpProxyServerConfig, 
                updatedAt: validationResult.server!.updatedAt 
            } }
        ]);
    } catch (error) {
        logger.error('Error in proxy auth:', error);
        return JsonResponse.errorResponse(500, 'Internal server error');
    }
}