import { NextRequest, NextResponse } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { discoverClients, ScanOptions } from '@/lib/services/clientDiscoveryService';
import { logger } from '@/lib/logging/server';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const options: ScanOptions = await request.json();
    
    logger.debug('[client-discovery] Scanning with options:', options);
    
    const clients = await discoverClients(options);
    
    logger.debug(`[client-discovery] Found ${clients.length} clients`);
    
    return JsonResponse.payloadResponse('clients', clients);
  } catch (error) {
    logger.error('Error in client discovery scan:', error);
    return JsonResponse.errorResponse(500, 'Internal server error');
  }
} 