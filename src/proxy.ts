import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy for localhost API routes.
 *
 * 1. Validates that the Host header matches a known localhost hostname.
 * 2. Enforces application/json Content-Type on mutation requests (POST/PUT/DELETE/PATCH).
 *
 * Replaces the Next.js 15 "middleware" convention. Same behavior, new name.
 */

const ALLOWED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

export function proxy(request: NextRequest) {
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
