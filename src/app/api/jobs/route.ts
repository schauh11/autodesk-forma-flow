import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { jobResults, tasks, projects } from '@/db/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { jobsQuerySchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parsed = jobsQuerySchema.safeParse({
    projectId: searchParams.get('projectId') || undefined,
    taskId: searchParams.get('taskId') || undefined,
    status: searchParams.get('status') || undefined,
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
    page: searchParams.get('page') || undefined,
    limit: searchParams.get('limit') || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { projectId, taskId, status, from, to, page, limit } = parsed.data;
  const offset = (page - 1) * limit;
  const fetchLimit = limit + 1;

  const conditions = [
    eq(tasks.isDeleted, false),
    eq(projects.isDeleted, false),
  ];

  if (projectId) conditions.push(eq(tasks.projectId, projectId));
  if (taskId) conditions.push(eq(jobResults.taskId, taskId));
  if (status) conditions.push(eq(jobResults.status, status));
  if (from) conditions.push(gte(jobResults.createdAt, new Date(from).toISOString()));
  if (to) conditions.push(lte(jobResults.createdAt, new Date(to).toISOString()));

  const raw = await db
    .select({
      job: jobResults,
      taskName: tasks.name,
      taskType: tasks.taskType,
      projectName: projects.projectName,
    })
    .from(jobResults)
    .leftJoin(tasks, eq(jobResults.taskId, tasks.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(jobResults.createdAt))
    .limit(fetchLimit)
    .offset(offset);

  const hasMore = raw.length > limit;
  const data = hasMore ? raw.slice(0, limit) : raw;

  return NextResponse.json({
    data,
    page,
    limit,
    hasMore,
  });
}
