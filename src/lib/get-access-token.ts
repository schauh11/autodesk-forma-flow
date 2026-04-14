import { decryptToken, encryptToken } from '@/lib/crypto';
import { refreshAccessToken } from '@/lib/aps';
import logger from '@/lib/logger';

export async function getAccessToken(): Promise<string> {
  const { getConfig, saveConfig } = await import('@/lib/config');
  const config = getConfig();

  if (!config.refresh_token_encrypted) {
    throw new Error('Autodesk account not connected. Please connect in Settings.');
  }

  if (!config.aps_client_id || !config.aps_client_secret) {
    throw new Error('APS credentials not configured. Please set them in Settings.');
  }

  // Decrypt refresh token
  const refreshToken = decryptToken(
    Buffer.from(config.refresh_token_encrypted, 'hex'),
    Buffer.from(config.refresh_token_iv, 'hex'),
    config.encryption_key
  );

  // Refresh access token via APS
  const tokenResponse = await refreshAccessToken(
    refreshToken,
    config.aps_client_id,
    config.aps_client_secret
  );

  // Save rotated refresh token if APS issued a new one
  if (tokenResponse.refresh_token && tokenResponse.refresh_token !== refreshToken) {
    const { ciphertext, iv } = encryptToken(tokenResponse.refresh_token, config.encryption_key);
    saveConfig({
      refresh_token_encrypted: ciphertext.toString('hex'),
      refresh_token_iv: iv.toString('hex'),
    });
    logger.info('APS refresh token rotated and saved');
  }

  return tokenResponse.access_token;
}
