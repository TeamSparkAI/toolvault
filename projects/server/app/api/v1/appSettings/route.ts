import { NextRequest, NextResponse } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const appSettingsModel = await ModelFactory.getInstance().getAppSettingsModel();
    const settings = await appSettingsModel.get();
    return NextResponse.json(settings);
  } catch (error) {
    logger.error('Error getting app settings:', error);
    return NextResponse.json(
      { error: 'Failed to get app settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const appSettingsModel = await ModelFactory.getInstance().getAppSettingsModel();
    const data = await request.json();
    await appSettingsModel.set(data);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error updating app settings:', error);
    return NextResponse.json(
      { error: 'Failed to update app settings' },
      { status: 500 }
    );
  }
} 