import { NextRequest, NextResponse } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

// Define the client settings type (single source of truth)
export interface ClientSettings {
  logLevel: string;
  // Future client settings can be added here
  // theme: 'dark' | 'light';
  // language: string;
  // etc.
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const settings: ClientSettings = {
      logLevel: logger.getCurrentLogLevel(),
      // Future settings can be added here
    };

    logger.info('Returning client settings:', settings);
    return JsonResponse.payloadResponse('data', settings);
  } catch (error) {
    logger.error('Failed to fetch client settings:', error);
    return JsonResponse.errorResponse(500, 'Failed to fetch client settings');
  }
} 