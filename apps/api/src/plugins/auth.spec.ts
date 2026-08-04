import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { Elysia } from 'elysia';
import { hashToken } from '../modules/auth/service';
import { Session } from '../schemas';
import { authPlugin } from './auth';

const OWNER_TOKEN = 'owner-token-abc';
const GUEST_TOKEN = 'guest-token-xyz';

function sessionWith(participants: { token: string; isOwner: boolean }[]) {
  return new Session({
    status: 'draft',
    participants: participants.map(({ token, isOwner }) => ({
      deviceTokenHash: hashToken(token),
      isOwner,
    })),
    lineItems: [],
  });
}

function mockLookup(session: unknown) {
  const promise = Promise.resolve(session);
  const query = Object.assign(promise, { select: mock(() => promise) });
  return spyOn(Session, 'findOne').mockImplementation((() => query) as never);
}

const app = new Elysia()
  .use(authPlugin)
  .get('/sessions/:sessionId', ({ participant }) => participant.isOwner, {
    auth: true,
  })
  .get(
    '/sessions/:sessionId/owner-only',
    ({ session }) => String(session._id),
    {
      owner: true,
    },
  );

function get(path: string, authorization?: string) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      headers: authorization ? { authorization } : {},
    }),
  );
}

describe('auth macro', () => {
  afterEach(() => {
    mock.restore();
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const findOne = mockLookup(null);

    const res = await get('/sessions/sid');

    expect(res.status).toBe(401);
    expect(await res.text()).toBe('Unauthorized');
    expect(findOne).not.toHaveBeenCalled();
  });

  it.each([
    ['a non-bearer scheme', 'Basic Zm9vOmJhcg=='],
    ['a bearer scheme with no token', 'Bearer'],
    ['an empty token', 'Bearer '],
  ])('returns 401 for %s', async (_label, authorization) => {
    const findOne = mockLookup(null);

    const res = await get('/sessions/sid', authorization);

    expect(res.status).toBe(401);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('accepts a lowercase bearer scheme', async () => {
    const session = sessionWith([{ token: OWNER_TOKEN, isOwner: true }]);
    mockLookup(session);

    const res = await get(`/sessions/${session._id}`, `bearer ${OWNER_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('returns 401 when the token matches no session', async () => {
    mockLookup(null);

    const res = await get('/sessions/sid', 'Bearer nope');

    expect(res.status).toBe(401);
    expect(await res.text()).toBe('Unauthorized');
  });

  it('returns 403 when the token belongs to another session', async () => {
    mockLookup(sessionWith([{ token: OWNER_TOKEN, isOwner: true }]));

    const res = await get(
      '/sessions/507f1f77bcf86cd799439011',
      `Bearer ${OWNER_TOKEN}`,
    );

    expect(res.status).toBe(403);
    expect(await res.text()).toBe('Forbidden');
  });

  it('resolves the participant that owns the token', async () => {
    const session = sessionWith([
      { token: OWNER_TOKEN, isOwner: true },
      { token: GUEST_TOKEN, isOwner: false },
    ]);
    mockLookup(session);

    const res = await get(`/sessions/${session._id}`, `Bearer ${GUEST_TOKEN}`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('false');
  });
});

describe('owner macro', () => {
  afterEach(() => {
    mock.restore();
  });

  it('lets the owner through', async () => {
    const session = sessionWith([{ token: OWNER_TOKEN, isOwner: true }]);
    mockLookup(session);

    const res = await get(
      `/sessions/${session._id}/owner-only`,
      `Bearer ${OWNER_TOKEN}`,
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(String(session._id));
  });

  it('returns 403 for a guest token', async () => {
    const session = sessionWith([
      { token: OWNER_TOKEN, isOwner: true },
      { token: GUEST_TOKEN, isOwner: false },
    ]);
    mockLookup(session);

    const res = await get(
      `/sessions/${session._id}/owner-only`,
      `Bearer ${GUEST_TOKEN}`,
    );

    expect(res.status).toBe(403);
    expect(await res.text()).toBe('Forbidden');
  });

  it('still returns 401 when there is no token at all', async () => {
    mockLookup(null);

    const res = await get('/sessions/sid/owner-only');

    expect(res.status).toBe(401);
  });
});
