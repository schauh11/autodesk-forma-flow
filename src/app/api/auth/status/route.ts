import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import logger from '@/lib/logger';

/**
 * GET /api/auth/status
 *
 * Validates the stored refresh token by attempting a token refresh.
 * Returns connection health so the UI can show green/red indicator.
 *
 * Called once on app load, not on every page navigation.
 */

// Simple in-memory cache to avoid spamming APS on rapid page loads.
let cachedStatus: { status: string; email: string; name: string; checkedAt: string } | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    const config = getConfig();

    // Quick fail: no credentials configured
    if (!config.aps_client_id || !config.aps_client_secret) {
      return NextResponse.json({
        status: 'disconnected',
        reason: 'APS credentials not configured',
        email: '',
        name: '',
      });
    }

    // Quick fail: never connected
    if (!config.refresh_token_encrypted) {
      return NextResponse.json({
        status: 'disconnected',
        reason: 'Autodesk account not connected',
        email: config.autodesk_user_email || '',
        name: config.autodesk_user_name || '',
      });
    }

    // Return cached result if still fresh
    if (cachedStatus && Date.now() < cacheExpiresAt) {
      return NextResponse.json({ ...cachedStatus, cached: true });
    }

    // Attempt a real token refresh to validate the refresh token
    const { getAccessToken } = await import('@/lib/get-access-token');
    await getAccessToken();

    // If we reach here, the token is valid
    cachedStatus = {
      status: 'connected',
      email: config.autodesk_user_email || '',
      name: config.autodesk_user_name || '',
      checkedAt: new Date().toISOString(),
    };
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    return NextResponse.json(cachedStatus);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Token validation failed';
    logger.warn({ err: error }, 'Connection health check failed');

    // Clear cache on failure
    cachedStatus = null;
    cacheExpiresAt = 0;

    return NextResponse.json({
      status: 'disconnected',
      reason,
      email: '',
      name: '',
    });
  }
}
