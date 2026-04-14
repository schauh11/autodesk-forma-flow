import { projects, tasks, jobResults } from '@/db/schema';

describe('schema', () => {
  it('should export all 3 tables', () => {
    expect(projects).toBeDefined();
    expect(tasks).toBeDefined();
    expect(jobResults).toBeDefined();
  });

  it('projects table should have apsProjectId column', () => {
    const columns = projects as Record<string, unknown>;
    expect(columns['apsProjectId']).toBeDefined();
  });

  it('tasks table should have taskType column', () => {
    const columns = tasks as Record<string, unknown>;
    expect(columns['taskType']).toBeDefined();
  });

  it('jobResults table should have status column', () => {
    const columns = jobResults as Record<string, unknown>;
    expect(columns['status']).toBeDefined();
  });
});
