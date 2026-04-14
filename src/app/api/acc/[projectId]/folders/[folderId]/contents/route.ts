import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAccessToken } from '@/lib/get-access-token';
import { APS_BASE_URL, normalizeProjectId } from '@/lib/aps';

type RouteParams = { params: Promise<{ projectId: string; folderId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { projectId, folderId } = await params;

  try {
    // Verify project exists
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.isDeleted, false)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Validate project has APS project ID configured
    if (!project.apsProjectId) {
      return NextResponse.json(
        { error: 'Project is missing APS project ID configuration' },
        { status: 400 }
      );
    }

    // Get access token using SSA or OAuth
    const accessToken = await getAccessToken();

    const normalizedId = normalizeProjectId(project.apsProjectId);
    const response = await fetch(
      `${APS_BASE_URL}/data/v1/projects/${normalizedId}/folders/${folderId}/contents`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch folder contents: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json() as { data: Array<{ attributes: { displayName: string; extension: { type: string } } }> };

    // Filter to show Revit models and folders
    const items = data.data || [];
    const filtered = items.filter((item) => {
      const ext = item.attributes?.extension?.type;
      return ext === 'folders:autodesk.bim360:Folder' ||
        ext === 'items:autodesk.bim360:File' ||
        item.attributes?.displayName?.endsWith('.rvt');
    });

    return NextResponse.json({ ...data, data: filtered });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: error instanceof Error && message.includes('not configured') ? 400 : 500 }
    );
  }
}
