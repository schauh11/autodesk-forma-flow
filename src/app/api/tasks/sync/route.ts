import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tasks, projects } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import logger from '@/lib/logger';

/**
 * GET /api/tasks/sync?projectId=xxx
 *
 * 2-way sync: checks which active scheduled tasks actually exist
 * in Windows Task Scheduler. Returns sync status per task so the
 * UI can show warnings for missing scheduled tasks.
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId');

    // Get all active tasks that have a schedule
    const allTasks = await db
      .select({ task: tasks, project: projects })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(tasks.isDeleted, false),
          ...(projectId ? [eq(tasks.projectId, projectId)] : [])
        )
      );

    const scheduled = allTasks.filter(({ task }) => task.scheduleCron);

    if (scheduled.length === 0) {
      return NextResponse.json([]);
    }

    // Check each task against Windows Task Scheduler
    const { checkTaskExists } = await import('@/lib/task-scheduler');

    const results = await Promise.all(
      scheduled.map(async ({ task, project }) => {
        const exists = await checkTaskExists(
          task.id,
          project.projectName || '',
          task.name
        );
        return {
          taskId: task.id,
          taskName: task.name,
          schedulerExists: exists,
          scheduleIsActive: task.scheduleIsActive,
        };
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    logger.error({ err: error }, 'GET /api/tasks/sync error');
    return NextResponse.json({ error: 'Failed to sync tasks' }, { status: 500 });
  }
}
