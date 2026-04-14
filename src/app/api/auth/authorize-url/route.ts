import crypto from 'crypto';
import { buildAuthorizationUrl } from '@/lib/aps/auth';
import { getConfig } from '@/lib/config';
import logger from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const config = getConfig();

    if (!config.aps_client_id) {
      return NextResponse.json({ error: 'Client ID not configured' }, { status: 400 });
    }

    const redirectUri = `${request.nextUrl.origin}/api/auth/callback`;
    const state = crypto.randomBytes(16).toString('hex');

    const url = buildAuthorizationUrl(config.aps_client_id, redirectUri, [
      'data:read', 'data:write', 'data:create',
    ], state);

    const response = NextResponse.json({ url }, { status: 200 });
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1800,
      path: '/api/auth/callback',
    });

    return response;
  } catch (error) {
    logger.error({ err: error }, 'GET /api/auth/authorize-url error');
    return NextResponse.json({ error: 'Failed to generate authorize URL' }, { status: 500 });
  }
}
