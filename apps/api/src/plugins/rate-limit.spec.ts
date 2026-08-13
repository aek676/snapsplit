import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Elysia, status } from 'elysia';
import { SessionModel } from '../modules/session/model';
import {
  createClientKey,
  joinRateLimit,
  joinRateLimitContext,
} from './rate-limit';

const MAX_ATTEMPTS = 10;

const app = new Elysia({ prefix: '/sessions' })
  .use(joinRateLimit)
  .post('/join/:code', ({ params }) => {
    if (params.code === 'BOOMBOOM') throw new Error('boom');
    return params.code === 'OPENOPEN'
      ? 'joined'
      : status(404, SessionModel.sessionNotFound.const);
  })
  .get('/join/:code', () => 'read')
  .post('/:sessionId/confirm', () => 'confirmed');

function join(code = 'ABCDEFGH') {
  return app.handle(
    new Request(`http://localhost/sessions/join/${code}`, { method: 'POST' }),
  );
}

async function exhaustTheWindow(code?: string) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) await join(code);
}

describe('client key', () => {
  const PEER = '203.0.113.7';
  const FORWARDED = '198.51.100.4';

  function requestFrom(forwarded?: string) {
    return new Request('http://localhost/sessions/join/ABCDEFGH', {
      method: 'POST',
      headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
    }) as Parameters<ReturnType<typeof createClientKey>>[0];
  }

  const server = {
    requestIP: () => ({ address: PEER }),
  } as unknown as Parameters<ReturnType<typeof createClientKey>>[1];

  it('uses the socket peer', () => {
    expect(createClientKey(false)(requestFrom(), server, {})).toBe(PEER);
  });

  it('ignores x-forwarded-for unless the proxy is trusted', () => {
    expect(createClientKey(false)(requestFrom(FORWARDED), server, {})).toBe(
      PEER,
    );
  });

  it('takes the last forwarded hop when the proxy is trusted', () => {
    expect(
      createClientKey(true)(requestFrom(`10.0.0.1, ${FORWARDED}`), server, {}),
    ).toBe(FORWARDED);
  });

  it('falls back to the peer when a trusted proxy sends no header', () => {
    expect(createClientKey(true)(requestFrom(), server, {})).toBe(PEER);
  });

  it('buckets callers together when there is no server to ask', () => {
    expect(createClientKey(false)(requestFrom(), null, {})).toBe('unknown');
  });
});

describe('join rate limit', () => {
  beforeEach(async () => {
    await joinRateLimitContext.reset();
  });

  afterEach(async () => {
    await joinRateLimitContext.reset();
  });

  it(`lets ${MAX_ATTEMPTS} attempts through and throttles the next one`, async () => {
    const allowed = [];
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++)
      allowed.push((await join('OPENOPEN')).status);

    expect(allowed).toEqual(Array(MAX_ATTEMPTS).fill(200));

    const res = await join('OPENOPEN');

    expect(res.status).toBe(429);
    expect(await res.text()).toBe(SessionModel.tooManyJoinAttempts.const);
  });

  it('counts attempts that answer 404', async () => {
    await exhaustTheWindow();

    expect((await join('OPENOPEN')).status).toBe(429);
  });

  it('counts attempts that blow up', async () => {
    await exhaustTheWindow('BOOMBOOM');

    expect((await join('OPENOPEN')).status).toBe(429);
  });

  it('advertises the remaining budget', async () => {
    const res = await join();

    expect(res.headers.get('RateLimit-Limit')).toBe(String(MAX_ATTEMPTS));
    expect(res.headers.get('RateLimit-Remaining')).toBe(
      String(MAX_ATTEMPTS - 1),
    );
    expect(Number(res.headers.get('RateLimit-Reset'))).toBeGreaterThan(0);
  });

  it('tells a throttled caller when to come back', async () => {
    await exhaustTheWindow();

    const res = await join();

    expect(res.headers.get('RateLimit-Remaining')).toBe('0');
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('spends no budget on the other session routes', async () => {
    for (let attempt = 0; attempt < 20; attempt++)
      await app.handle(
        new Request(
          'http://localhost/sessions/507f191e810c19729de860ea/confirm',
          {
            method: 'POST',
          },
        ),
      );

    expect((await join('OPENOPEN')).status).toBe(200);
  });

  it('spends no budget on reads of the same path', async () => {
    for (let attempt = 0; attempt < 20; attempt++)
      await app.handle(new Request('http://localhost/sessions/join/ABCDEFGH'));

    expect((await join('OPENOPEN')).status).toBe(200);
  });

  it('frees the caller once the window is reset', async () => {
    await exhaustTheWindow();
    expect((await join()).status).toBe(429);

    await joinRateLimitContext.reset();

    expect((await join('OPENOPEN')).status).toBe(200);
  });
});
