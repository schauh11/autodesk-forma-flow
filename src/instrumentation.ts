/**
 * Next.js Instrumentation Hook
 * Runs once on server startup.
 */
export async function register() {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    const logger = (await import('@/lib/logger')).default;
    logger.info('Forma Flow server started');
  }
}
