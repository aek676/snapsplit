import { afterEach, describe, expect, it } from 'vitest';
import { authHeader, sessionIdFromPath } from '@/lib/auth-headers';
import { setToken } from '@/utils/device-token';

const SESSION_ID = '507f1f77bcf86cd799439011';

const auth = { participantId: 'participant-1', token: 'token-1' };

afterEach(() => {
  localStorage.clear();
});

describe('sessionIdFromPath', () => {
  it.each([
    ['the session itself', `/sessions/${SESSION_ID}`],
    ['a nested resource', `/sessions/${SESSION_ID}/line-items`],
    ['a nested resource id', `/sessions/${SESSION_ID}/line-items/abc`],
  ])('reads the id from %s', (_label, path) => {
    expect(sessionIdFromPath(path)).toBe(SESSION_ID);
  });

  it.each([
    ['the analyze route', '/sessions/analyze'],
    ['the collection', '/sessions'],
    ['a segment that is not an ObjectId', '/sessions/join'],
    ['another resource', '/receipts/abc'],
  ])('returns null for %s', (_label, path) => {
    expect(sessionIdFromPath(path)).toBeNull();
  });
});

describe('authHeader', () => {
  it('sends the token stored for that session', () => {
    setToken(SESSION_ID, auth);

    expect(authHeader(`/sessions/${SESSION_ID}/line-items`)).toEqual({
      authorization: 'Bearer token-1',
    });
  });

  it('sends nothing when the session has no stored token', () => {
    expect(authHeader(`/sessions/${SESSION_ID}`)).toBeUndefined();
  });

  it('sends nothing on a route that names no session', () => {
    setToken(SESSION_ID, auth);

    expect(authHeader('/sessions/analyze')).toBeUndefined();
  });
});
