import { APS_BASE_URL } from '@/lib/aps';
import { getAccessToken } from '@/lib/get-access-token';
import logger from '@/lib/logger';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const accessToken = await getAccessToken();

    // Fetch hubs
    const hubsResponse = await fetch(`${APS_BASE_URL}/project/v1/hubs`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!hubsResponse.ok) {
      const error = await hubsResponse.text();
      logger.error({ status: hubsResponse.status, body: error }, 'Hubs API error');
      return NextResponse.json(
        { error: `Failed to fetch hubs: ${hubsResponse.status}` },
        { status: hubsResponse.status }
      );
    }

    const hubsData = await hubsResponse.json();
    return NextResponse.json(hubsData.data || []);
  } catch (error) {
    logger.error({ err: error }, 'GET /api/hubs error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch hubs' },
      { status: 500 }
    );
  }
}
