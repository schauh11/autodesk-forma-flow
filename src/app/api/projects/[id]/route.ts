import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { updateProjectSchema } from '@/lib/validations';
import logger from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.isDeleted, false)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    logger.error({ err: error }, 'GET /api/projects/[id] error');
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const raw = await request.json();
    const parsed = updateProjectSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // Only update explicitly allowed fields
    const safeUpdates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.projectName !== undefined) safeUpdates['projectName'] = body.projectName;
    if (body.hubId !== undefined) safeUpdates['hubId'] = body.hubId;
    if (body.apsProjectId !== undefined) safeUpdates['apsProjectId'] = body.apsProjectId;

    const [updated] = await db
      .update(projects)
      .set(safeUpdates)
      .where(and(eq(projects.id, id), eq(projects.isDeleted, false)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'PUT /api/projects/[id] error');
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const [updated] = await db
      .update(projects)
      .set({ isDeleted: true, updatedAt: new Date().toISOString() })
      .where(and(eq(projects.id, id), eq(projects.isDeleted, false)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'DELETE /api/projects/[id] error');
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
