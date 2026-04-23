import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, tasks, modelInsights } from '@/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import logger from '@/lib/logger';
import { getAccessToken } from '@/lib/get-access-token';
import { APS_BASE_URL, normalizeProjectId } from '@/lib/aps/auth';

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

    // Get latest + previous model insights for delta comparison
    const snapshots = await db
      .select()
      .from(modelInsights)
      .where(eq(modelInsights.projectId, projectId))
      .orderBy(desc(modelInsights.fetchedAt))
      .limit(2);

    const latest = snapshots[0];
    const previous = snapshots[1] || null;

    if (!latest) {
      return NextResponse.json(
        { error: 'No model insights available. Run a publish task to generate insights.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ...latest, previous });
  } catch (error) {
    logger.error({ err: error }, 'GET /api/insights/[projectId] error');
    return NextResponse.json({ error: 'Failed to fetch model insights' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
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

    // Get the first PUBLISH_MODEL task for this project to find the targetModelId
    const [publishTask] = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, projectId),
          eq(tasks.taskType, 'PUBLISH_MODEL'),
          eq(tasks.isDeleted, false)
        )
      )
      .limit(1);

    if (!publishTask || !publishTask.targetModelId) {
      return NextResponse.json(
        { error: 'No publish task with model selected found for this project' },
        { status: 400 }
      );
    }

    // Get access token
    const accessToken = await getAccessToken();

    // The targetModelId is the full lineage URN (e.g., urn:adsk.wipprod:dm.lineage:AbCdEf)
    // Data Management API uses the full URN as the item identifier
    const lineageUrn = publishTask.targetModelId;
    const apsProjectId = normalizeProjectId(project.apsProjectId || '');

    // Get the tip (latest version) from Data Management API
    const tipUrl = `${APS_BASE_URL}/data/v1/projects/${apsProjectId}/items/${encodeURIComponent(lineageUrn)}/tip`;
    const tipResponse = await fetch(tipUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!tipResponse.ok) {
      const errorBody = await tipResponse.text().catch(() => '');
      logger.error({ status: tipResponse.status, url: tipUrl, body: errorBody }, 'Failed to get tip version');
      return NextResponse.json({ error: `Failed to get model version: ${tipResponse.status}` }, { status: 500 });
    }

    const tipData = await tipResponse.json() as { data: { id: string; attributes: { version: number; storageSize?: number; lastModifiedTime?: string } } };
    const versionId = tipData.data.id;
    const versionNumber = tipData.data.attributes.version;
    const fileSize = tipData.data.attributes.storageSize || 0;
    const lastModifiedAt = tipData.data.attributes.lastModifiedTime || '';

    // Encode version ID as URN for Model Derivative API
    const versionUrn = Buffer.from(versionId).toString('base64url');

    // Call Model Derivative API to extract metadata
    const { getModelMetadataWithRetry, getObjectTree, getPropertiesWithRetry, getLinkedFiles } = await import('@/lib/aps/model-derivative');
    const { extractInsightsFromTree } = await import('@/lib/aps/insights-extractor');

    // Fetch metadata, tree, properties, and linked files in parallel
    const metadata = await getModelMetadataWithRetry(accessToken, versionUrn);
    const view3d = metadata.find(m => m.role === '3d') || metadata[0];
    if (!view3d) {
      return NextResponse.json({ error: 'No viewable found for this model. It may still be processing.' }, { status: 400 });
    }

    const [treeData, properties, linkedFiles] = await Promise.all([
      getObjectTree(accessToken, versionUrn, view3d.guid),
      getPropertiesWithRetry(accessToken, versionUrn, view3d.guid),
      getLinkedFiles(accessToken, apsProjectId, versionId),
    ]);

    // Count sheets/2D views from the metadata viewables list
    const sheetCount = metadata.filter(m => m.role === '2d').length;
    const viewCount = metadata.length;

    // Separate Revit links (.rvt) from other links (.dwg, .pdf, etc.)
    const revitLinks = linkedFiles.filter(f => f.name.toLowerCase().endsWith('.rvt'));
    const cadLinks = linkedFiles.filter(f => !f.name.toLowerCase().endsWith('.rvt'));

    const insights = extractInsightsFromTree(treeData, properties, fileSize, lastModifiedAt, viewCount, sheetCount);

    // Override link counts with actual data from Linked Files API
    insights.revitLinkCount = revitLinks.length;
    insights.cadLinkCount = cadLinks.length;
    insights.details.revitLinks = revitLinks.map(f => `${f.name} (${f.status})`);
    insights.details.cadLinks = cadLinks.map(f => `${f.name} (${f.status})`);

    const now = new Date().toISOString();
    const [newInsight] = await db
      .insert(modelInsights)
      .values({
        projectId,
        itemId: lineageUrn,
        versionNumber,
        fileSize,
        viewCount: insights.viewCount,
        sheetCount: insights.sheetCount,
        scheduleCount: insights.scheduleCount,
        revitLinkCount: insights.revitLinkCount,
        cadLinkCount: insights.cadLinkCount,
        familyCount: insights.familyCount,
        inPlaceCount: insights.inPlaceCount,
        roomCount: insights.roomCount,
        levelCount: insights.levelCount,
        totalElements: insights.totalElements,
        healthScore: insights.healthScore,
        details: { ...insights.details, versionUrn, lineageUrn, versionId },
        fetchedAt: now,
      })
      .returning();

    return NextResponse.json(newInsight, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ err: error }, 'POST /api/insights/[projectId] error');
    return NextResponse.json({ error: `Failed to generate model insights: ${message}` }, { status: 500 });
  }
}
