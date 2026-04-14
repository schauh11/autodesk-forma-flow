import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAccessToken } from '@/lib/get-access-token';
import { APS_BASE_URL } from '@/lib/aps';
import logger from '@/lib/logger';

type RouteParams = { params: Promise<{ projectId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;

  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.isDeleted, false)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.apsProjectId || !project.hubId) {
      return NextResponse.json(
        { error: 'Project is missing APS project ID or hub ID' },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    // Use the same endpoint as discover.py: /project/v1/hubs/{hubId}/projects/{projectId}/topFolders
    const response = await fetch(
      `${APS_BASE_URL}/project/v1/hubs/${project.hubId}/projects/${project.apsProjectId}/topFolders`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, body: error }, 'APS topFolders error');
      return NextResponse.json(
        { error: `Failed to fetch folders: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data || [] });
  } catch (error) {
    logger.error({ err: error }, 'GET /api/acc/[projectId]/folders error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch folders' },
      { status: 500 }
    );
  }
}
