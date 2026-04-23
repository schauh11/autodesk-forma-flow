import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy for localhost API routes.
 *
 * 1. Rate limits requests per IP (60 per minute).
 * 2. Validates that the Host header matches a known localhost hostname.
 * 3. Enforces application/json Content-Type on mutation requests (POST/PUT/DELETE/PATCH).
 *
 * Replaces the Next.js 15 "middleware" convention. Same behavior, new name.
 */

const ALLOWED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 60; // requests per window
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter(t => now - t < RATE_WINDOW_MS);
    if (valid.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, valid);
  }
}, RATE_WINDOW_MS);

export function proxy(request: NextRequest) {
  // Rate limiting: 60 requests per minute per IP
  const clientIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const now = Date.now();
  const timestamps = rateLimitMap.get(clientIp) || [];
  const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  recent.push(now);
  rateLimitMap.set(clientIp, recent);

  // Validate Host header. Only allow known localhost hostnames (any port).
  const host = request.headers.get('host');
  const hostname = host?.replace(/:\d+$/, '') ?? '';
  if (!ALLOWED_HOSTNAMES.has(hostname)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Content-Type enforcement on state-changing methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const contentType = request.headers.get('content-type');
    // Allow requests with no Content-Type (e.g. DELETE with no body)
    if (contentType && !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
