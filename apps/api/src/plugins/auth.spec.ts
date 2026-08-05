import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { Elysia } from 'elysia';
import { hashToken } from '../modules/auth/service';
import { Session } from '../schemas';
import { authPlugin } from './auth';

const OWNER_TOKEN = 'owner-token-abc';
const GUEST_TOKEN = 'guest-token-xyz';
/** Well-formed id: the routes reject anything that is not an ObjectId. */
const SESSION_ID = '507f191e810c19729de860ea';

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
  const findOne = mock((_filter: unknown) => query);
  spyOn(Session, 'findOne').mockImplementation(findOne as never);
  return findOne;
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

    const res = await get(`/sessions/${SESSION_ID}`);

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

    const res = await get(`/sessions/${SESSION_ID}`, authorization);

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

    const res = await get(`/sessions/${SESSION_ID}`, 'Bearer nope');

    expect(res.status).toBe(401);
    expect(await res.text()).toBe('Unauthorized');
  });

  it('returns 422 without a lookup when the id is not an ObjectId', async () => {
    const findOne = mockLookup(null);

    const res = await get(
      '/sessions/not-an-object-id',
      `Bearer ${OWNER_TOKEN}`,
    );

    expect(res.status).toBe(422);
    expect(await res.text()).toBe('Invalid id');
    expect(findOne).not.toHaveBeenCalled();
  });

  it('looks the session up by the hash, never by the raw token', async () => {
    const session = sessionWith([{ token: OWNER_TOKEN, isOwner: true }]);
    const findOne = mockLookup(session);

    await get(`/sessions/${session._id}`, `Bearer ${OWNER_TOKEN}`);

    expect(findOne.mock.calls[0][0]).toEqual({
      'participants.deviceTokenHash': hashToken(OWNER_TOKEN),
    });
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

    const res = await get(`/sessions/${SESSION_ID}/owner-only`);

    expect(res.status).toBe(401);
  });
});
