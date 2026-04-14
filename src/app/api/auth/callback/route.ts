import { exchangeCodeForTokens, APS_BASE_URL } from '@/lib/aps/auth';
import { encryptToken } from '@/lib/crypto';
import { getConfig, saveConfig } from '@/lib/config';
import logger from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

function htmlResponse(status: number, body: string): NextResponse {
  return new NextResponse(body, { status, headers: { 'Content-Type': 'text/html' } });
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');

    if (!code) {
      return htmlResponse(400, 'Missing authorization code');
    }

    // Validate CSRF state
    const expectedState = request.cookies.get('oauth_state')?.value;
    if (!state || !expectedState || state !== expectedState) {
      const response = htmlResponse(403, `<html><body><p>Invalid state parameter.</p>
        <script>if(window.opener){window.opener.postMessage({type:'auth-error',error:'Invalid state'},window.location.origin);}setTimeout(()=>window.close(),3000);</script></body></html>`);
      response.cookies.set('oauth_state', '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/api/auth/callback' });
      return response;
    }

    const config = getConfig();

    if (!config.aps_client_id || !config.aps_client_secret) {
      return htmlResponse(400, 'APS credentials not configured');
    }

    const redirectUri = `${origin}/api/auth/callback`;
    const tokens = await exchangeCodeForTokens(code, config.aps_client_id, config.aps_client_secret, redirectUri);

    if (!tokens.refresh_token) {
      throw new Error('No refresh token received from Autodesk');
    }

    // Get user profile from Autodesk
    let userEmail = '';
    let userName = '';
    try {
      const profileRes = await fetch(`${APS_BASE_URL}/userprofile/v1/users/@me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json() as { emailId?: string; firstName?: string; lastName?: string };
        userEmail = profile.emailId || '';
        userName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
      }
    } catch (e) {
      logger.warn({ err: e }, 'Failed to fetch user profile');
    }

    // Encrypt and save refresh token
    const { ciphertext, iv } = encryptToken(tokens.refresh_token, config.encryption_key);
    saveConfig({
      refresh_token_encrypted: ciphertext.toString('hex'),
      refresh_token_iv: iv.toString('hex'),
      autodesk_user_email: userEmail,
      autodesk_user_name: userName,
      connected_at: new Date().toISOString(),
    });

    logger.info('Autodesk account connected successfully');

    // Close popup and notify parent window
    const response = htmlResponse(200, `<html><body><p>Connected! This window will close.</p>
      <script>if(window.opener){window.opener.postMessage({type:'auth-complete'},window.location.origin);}window.close();</script></body></html>`);

    // Clear state cookie
    response.cookies.set('oauth_state', '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/api/auth/callback' });
    return response;
  } catch (error) {
    logger.error({ err: error }, 'GET /api/auth/callback error');
    const response = htmlResponse(500, `<html><body><p>Authorization failed.</p>
      <script>if(window.opener){window.opener.postMessage({type:'auth-error',error:'Authorization failed'},window.location.origin);}setTimeout(()=>window.close(),3000);</script></body></html>`);
    response.cookies.set('oauth_state', '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/api/auth/callback' });
    return response;
  }
}
