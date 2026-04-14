import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq } from 'drizzle-orm';
import logger from '@/lib/logger';
import { createProjectSchema } from '@/lib/validations';

export async function GET() {
  try {
    const allProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.isDeleted, false));

    return NextResponse.json(allProjects);
  } catch (error) {
    logger.error({ err: error }, 'GET /api/projects error');
    const status = error instanceof Error && 'status' in error ? (error as { status: number }).status : 500;
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = createProjectSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const [project] = await db
      .insert(projects)
      .values({
        hubId: body.hubId,
        apsProjectId: body.apsProjectId,
        projectName: body.projectName,
      })
      .returning();

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'POST /api/projects error');
    const status = error instanceof Error && 'status' in error ? (error as { status: number }).status : 500;
    return NextResponse.json({ error: 'Failed to create project' }, { status });
  }
}
