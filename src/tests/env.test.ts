describe('env validation', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear all relevant env vars
    delete process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;
    delete process.env.FORMA_FLOW_DATA_DIR;
    // Clear module cache so env.ts re-parses
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should parse valid env with defaults', async () => {
    // No env vars set, should use defaults
    const { env } = await import('@/lib/env');
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBeUndefined();
  });

  it('should accept custom FORMA_FLOW_DATA_DIR', async () => {
    process.env.FORMA_FLOW_DATA_DIR = '/custom/data/dir';
    const { env } = await import('@/lib/env');
    expect(env.FORMA_FLOW_DATA_DIR).toBe('/custom/data/dir');
  });

  it('should default NODE_ENV to development', async () => {
    // Explicitly clear NODE_ENV if set
    delete process.env.NODE_ENV;
    const { env } = await import('@/lib/env');
    expect(env.NODE_ENV).toBe('development');
  });
});
