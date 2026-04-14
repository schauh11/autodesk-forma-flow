import { getConfig, saveConfig } from '@/lib/config';
import logger from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { updateSettingsSchema } from '@/lib/validations';

export async function GET() {
  try {
    const config = getConfig();

    return NextResponse.json({
      aps_client_id: config.aps_client_id || '',
      has_secret: !!config.aps_client_secret,
      is_connected: !!config.connected_at,
      email: config.autodesk_user_email || null,
      name: config.autodesk_user_name || null,
      connected_at: config.connected_at || null,
    });
  } catch (error) {
    logger.error({ err: error }, 'GET /api/settings error');
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = updateSettingsSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const updates: Record<string, string | undefined> = {};
    if (body.clientId !== undefined) updates['aps_client_id'] = body.clientId;
    if (body.clientSecret !== undefined) updates['aps_client_secret'] = body.clientSecret;

    saveConfig(updates as Record<string, string>);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'POST /api/settings error');
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
