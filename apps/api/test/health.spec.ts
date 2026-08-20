import { describe, expect, it } from 'bun:test';
import { app } from '../src/app';

function get(path: string) {
  return app.handle(new Request(`http://localhost${path}`));
}

describe('health endpoints', () => {
  it('reports overall health with uptime', async () => {
    const res = await get('/healthz');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      healthy: true,
      uptime: expect.any(Number),
    });
  });

  it('reports liveness while the process is up', async () => {
    const res = await get('/healthz/live');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      healthy: true,
      uptime: expect.any(Number),
      checks: {},
    });
  });

  it('reports readiness while the database is connected', async () => {
    const res = await get('/healthz/ready');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      healthy: true,
      uptime: expect.any(Number),
      checks: { mongodb: { healthy: true } },
    });
  });
});
