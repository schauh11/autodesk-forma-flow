import { APS_BASE_URL } from '@/lib/aps';
import { getAccessToken } from '@/lib/get-access-token';
import logger from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;
    // Decode URL-encoded hubId and normalize (ensure 'b.' prefix for account hubs)
    const decodedHubId = decodeURIComponent(hubId);
    const normalizedHubId = decodedHubId.startsWith('b.') ? decodedHubId : `b.${decodedHubId}`;

    const accessToken = await getAccessToken();

    // Fetch projects for hub
    const projectsResponse = await fetch(
      `${APS_BASE_URL}/project/v1/hubs/${normalizedHubId}/projects?page[limit]=100`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!projectsResponse.ok) {
      const error = await projectsResponse.text();
      logger.error({ status: projectsResponse.status, body: error }, 'Projects API error');
      return NextResponse.json(
        { error: `Failed to fetch projects: ${projectsResponse.status}` },
        { status: projectsResponse.status }
      );
    }

    const projectsData = await projectsResponse.json();
    return NextResponse.json(projectsData.data || []);
  } catch (error) {
    logger.error({ err: error }, 'GET /api/hubs/[hubId]/projects error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
