import pino from 'pino';

const logger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  redact: {
    paths: [
      // Generic
      '*.token',
      '*.refreshToken',
      '*.refresh_token',
      '*.accessToken',
      '*.access_token',
      '*.secret',
      '*.client_secret',
      '*.aps_client_secret',
      '*.password',
      '*.authorization',
      'req.headers.authorization',
      'req.headers.cookie',
      // App-specific (config shape)
      '*.encryption_key',
      '*.ENCRYPTION_KEY',
      '*.refresh_token_encrypted',
      '*.refresh_token_iv',
    ],
    censor: '[REDACTED]',
  },
  transport:
    process.env['NODE_ENV'] === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

export default logger;
