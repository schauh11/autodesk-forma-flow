import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { jobResults, tasks, projects } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import logger from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const result = await db
      .select({
        job: jobResults,
        taskName: tasks.name,
        taskType: tasks.taskType,
        projectName: projects.projectName,
      })
      .from(jobResults)
      .leftJoin(tasks, and(eq(jobResults.taskId, tasks.id), eq(tasks.isDeleted, false)))
      .leftJoin(projects, and(eq(tasks.projectId, projects.id), eq(projects.isDeleted, false)))
      .where(eq(jobResults.id, id))
      .limit(1);

    if (!result[0]) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    logger.error({ err: error }, 'GET /api/jobs/[id] error');
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 });
  }
}
