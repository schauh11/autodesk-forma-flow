import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, modelInsights } from '@/db/schema';
import { and, eq, asc } from 'drizzle-orm';
import logger from '@/lib/logger';

type RouteParams = { params: Promise<{ projectId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;

    // Verify project exists and is not soft-deleted
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.isDeleted, false)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all model insights for this project, ordered by fetchedAt ascending (for charts)
    const insights = await db
      .select({
        id: modelInsights.id,
        versionNumber: modelInsights.versionNumber,
        fileSize: modelInsights.fileSize,
        viewCount: modelInsights.viewCount,
        sheetCount: modelInsights.sheetCount,
        scheduleCount: modelInsights.scheduleCount,
        revitLinkCount: modelInsights.revitLinkCount,
        cadLinkCount: modelInsights.cadLinkCount,
        familyCount: modelInsights.familyCount,
        inPlaceCount: modelInsights.inPlaceCount,
        roomCount: modelInsights.roomCount,
        levelCount: modelInsights.levelCount,
        healthScore: modelInsights.healthScore,
        fetchedAt: modelInsights.fetchedAt,
      })
      .from(modelInsights)
      .where(eq(modelInsights.projectId, projectId))
      .orderBy(asc(modelInsights.fetchedAt));

    return NextResponse.json(insights);
  } catch (error) {
    logger.error({ err: error }, 'GET /api/insights/[projectId]/history error');
    return NextResponse.json({ error: 'Failed to fetch insights history' }, { status: 500 });
  }
}
