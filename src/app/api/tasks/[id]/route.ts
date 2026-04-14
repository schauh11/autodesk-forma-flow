import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tasks, projects } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import logger from '@/lib/logger';
import { updateTaskSchema } from '@/lib/validations';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.isDeleted, false)))
      .limit(1);

    if (!task) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    logger.error({ err: error }, 'GET /api/tasks/[id] error');
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const raw = await request.json();
    const parsed = updateTaskSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const [existing] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.isDeleted, false)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Only update explicitly allowed fields
    const safeUpdates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.name !== undefined) safeUpdates['name'] = body.name;
    if (body.scheduleCron !== undefined) safeUpdates['scheduleCron'] = body.scheduleCron;
    if (body.scheduleIsActive !== undefined) safeUpdates['scheduleIsActive'] = body.scheduleIsActive;
    if (body.targetModelId !== undefined) safeUpdates['targetModelId'] = body.targetModelId;
    if (body.targetModelName !== undefined) safeUpdates['targetModelName'] = body.targetModelName;

    const [updated] = await db
      .update(tasks)
      .set(safeUpdates)
      .where(and(eq(tasks.id, id), eq(tasks.isDeleted, false)))
      .returning();

    // Sync schedule changes to Windows Task Scheduler
    try {
      const [project] = await db.select().from(projects).where(eq(projects.id, existing.projectId)).limit(1);
      const projName = project?.projectName || '';
      const tName = updated?.name || existing.name;

      if (body.scheduleCron) {
        const { updateScheduledTask } = await import('@/lib/task-scheduler');
        const result = await updateScheduledTask(id, body.scheduleCron, tName, projName);
        if (!result.success) {
          logger.warn({ taskId: id, error: result.error }, 'Failed to update scheduled task');
        }
      }

      if (body.scheduleIsActive === false) {
        const { disableScheduledTask } = await import('@/lib/task-scheduler');
        const result = await disableScheduledTask(id, projName, tName);
        if (!result.success) {
          logger.warn({ taskId: id, error: result.error }, 'Failed to disable scheduled task');
        }
      } else if (body.scheduleIsActive === true && existing.scheduleCron) {
        const { enableScheduledTask } = await import('@/lib/task-scheduler');
        const result = await enableScheduledTask(id, projName, tName);
        if (!result.success) {
          logger.warn({ taskId: id, error: result.error }, 'Failed to enable scheduled task');
        }
      }
    } catch (err) {
      logger.warn({ taskId: id, err }, 'Task Scheduler integration unavailable');
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error }, 'PUT /api/tasks/[id] error');
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [existing] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.isDeleted, false)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await db
      .update(tasks)
      .set({ isDeleted: true, updatedAt: new Date().toISOString() })
      .where(and(eq(tasks.id, id), eq(tasks.isDeleted, false)));

    // Remove from Windows Task Scheduler
    try {
      const [project] = await db.select().from(projects).where(eq(projects.id, existing.projectId)).limit(1);
      const { deleteScheduledTask } = await import('@/lib/task-scheduler');
      await deleteScheduledTask(id, project?.projectName || '', existing.name);
    } catch (err) {
      logger.warn({ taskId: id, err }, 'Failed to remove scheduled task');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'DELETE /api/tasks/[id] error');
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
