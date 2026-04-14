export const APS_BASE_URL = 'https://developer.api.autodesk.com';

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

export function normalizeProjectId(id: string): string {
  return id.startsWith('b.') ? id : `b.${id}`;
}

export function buildAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  scopes: string[] = ['data:read', 'data:write', 'data:create', 'code:all'],
  state?: string
): string {
  // Use encodeURIComponent for proper %20 encoding (not + from URLSearchParams)
  const params = [
    `response_type=code`,
    `client_id=${encodeURIComponent(clientId)}`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    `scope=${encodeURIComponent(scopes.join(' '))}`,
    ...(state ? [`state=${encodeURIComponent(state)}`] : []),
  ].join('&');
  return `${APS_BASE_URL}/authentication/v2/authorize?${params}`;
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<TokenResponse> {
  const response = await fetch(`${APS_BASE_URL}/authentication/v2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`APS token exchange failed: ${response.status} ${error}`);
  }

  return response.json() as Promise<TokenResponse>;
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  scope: string = 'data:read data:write data:create'
): Promise<TokenResponse> {
  const response = await fetch(`${APS_BASE_URL}/authentication/v2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`APS token refresh failed: ${response.status} ${error}`);
  }

  return response.json() as Promise<TokenResponse>;
}
