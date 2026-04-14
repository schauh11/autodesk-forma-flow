import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tasks, projects } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import logger from '@/lib/logger';
import { createTaskSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId');

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

    return NextResponse.json(allTasks.map(({ task }) => task));
  } catch (error) {
    logger.error({ err: error }, 'GET /api/tasks error');
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = createTaskSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // Verify project exists and is not soft-deleted
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, body.projectId), eq(projects.isDeleted, false)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const [task] = await db
      .insert(tasks)
      .values({
        projectId: body.projectId,
        name: body.name,
        taskType: body.taskType || 'PUBLISH_MODEL',
        targetModelId: body.targetModelId,
        targetModelName: body.targetModelName,
        scheduleCron: body.scheduleCron,
      })
      .returning();

    // Sync to Windows Task Scheduler
    if (task?.scheduleCron) {
      try {
        const { createScheduledTask } = await import('@/lib/task-scheduler');
        const result = await createScheduledTask(task.id, task.name, task.scheduleCron, project?.projectName || undefined);
        if (!result.success) {
          logger.warn({ taskId: task.id, error: result.error }, 'Failed to create scheduled task');
        }
      } catch (err) {
        logger.warn({ taskId: task.id, err }, 'Task Scheduler integration unavailable');
      }
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'POST /api/tasks error');
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
