import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tasks, projects, jobResults } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAccessToken } from '@/lib/get-access-token';
import { publishModel } from '@/lib/aps';
import logger from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    // Get task with project (exclude soft-deleted)
    const result = await db
      .select({ task: tasks, project: projects })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(eq(tasks.id, id), eq(tasks.isDeleted, false), eq(projects.isDeleted, false)))
      .limit(1);

    if (!result[0]) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const { task, project } = result[0];

    // Validate required fields
    if (!task.targetModelId || !project.apsProjectId) {
      return NextResponse.json(
        { error: 'Task is missing target model or project APS ID' },
        { status: 400 }
      );
    }

    // Create job result record
    const [jobResult] = await db
      .insert(jobResults)
      .values({
        taskId: task.id,
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
      })
      .returning();

    if (!jobResult) {
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
    }

    try {
      // Get access token and publish the model
      const accessToken = await getAccessToken();
      const commandId = await publishModel(accessToken, project.apsProjectId, task.targetModelId);

      // Update job result with success
      await db
        .update(jobResults)
        .set({
          status: 'SUCCESS',
          completedAt: new Date().toISOString(),
          resultData: { commandId },
        })
        .where(eq(jobResults.id, jobResult.id));

      logger.info({ taskId: task.id, commandId }, 'Model publish triggered successfully');

      // Auto-trigger insights extraction in background (non-blocking)
      // Uses hardcoded localhost to avoid SSRF via Host header manipulation
      setTimeout(async () => {
        try {
          const port = process.env['PORT'] || 3000;
          await fetch(`http://127.0.0.1:${port}/api/insights/${project.id}`, { method: 'POST' });
          logger.info({ projectId: project.id }, 'Background insights extraction triggered after publish');
        } catch (err) {
          logger.warn({ projectId: project.id, err }, 'Background insights extraction failed (non-critical)');
        }
      }, 5000);

      return NextResponse.json(
        { jobResultId: jobResult.id, commandId, status: 'SUCCESS' },
        { status: 200 }
      );
    } catch (publishError) {
      // Update job result with failure
      const errorMessage = publishError instanceof Error ? publishError.message : 'Unknown error';
      await db
        .update(jobResults)
        .set({
          status: 'FAILED',
          completedAt: new Date().toISOString(),
          errorDetails: { message: errorMessage },
        })
        .where(eq(jobResults.id, jobResult.id));

      logger.error(
        { taskId: task.id, error: errorMessage },
        'Failed to publish model'
      );

      return NextResponse.json(
        { jobResultId: jobResult.id, error: errorMessage, status: 'FAILED' },
        { status: 400 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: message }, 'Error in run-now endpoint');
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
