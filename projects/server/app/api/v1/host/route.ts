import { NextResponse, NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { BridgeManager } from '@/lib/bridge/BridgeManager';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const hostModel = await ModelFactory.getInstance().getHostModel();
    const host = await hostModel.get();
    return NextResponse.json(host);
  } catch (error) {
    logger.error('Error getting MCP host:', error);
    return NextResponse.json({ error: 'Failed to get MCP host' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const hostModel = await ModelFactory.getInstance().getHostModel();
    const host = await request.json();
    await hostModel.set(host);
    await BridgeManager.getInstance().restart();
    return NextResponse.json(host);
  } catch (error) {
    logger.error('Error setting MCP host:', error);
    return NextResponse.json({ error: 'Failed to set MCP host' }, { status: 500 });
  }
}