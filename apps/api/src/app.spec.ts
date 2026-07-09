import { describe, expect, it } from 'bun:test';
import { app } from './app';

describe('api app', () => {
  it('GET / returns the greeting', async () => {
    const response = await app.handle(new Request('http://localhost/'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ hello: 'snapsplit' });
  });
});