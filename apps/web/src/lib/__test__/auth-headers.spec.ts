import { afterEach, describe, expect, it } from 'vitest';
import { authHeader, sessionIdFromPath, sessionIdFromUrl } from '@/lib/auth';
import { rememberSessionCode, setToken } from '@/utils/device-token';

const SESSION_ID = '507f1f77bcf86cd799439011';
const SESSION_CODE = 'ABCD2345';

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

describe('sessionIdFromUrl', () => {
  it.each([
    ['an absolute api url', `http://localhost:3000/sessions/${SESSION_ID}`],
    [
      'a nested resource',
      `http://localhost:3000/sessions/${SESSION_ID}/line-items`,
    ],
    ['a query string', `http://localhost:3000/sessions/${SESSION_ID}?x=1`],
    [
      'an api mounted under a base path',
      `http://localhost:3000/api/sessions/${SESSION_ID}`,
    ],
  ])('reads the id from %s', (_label, url) => {
    expect(sessionIdFromUrl(url)).toBe(SESSION_ID);
  });

  it.each([
    ['the analyze route', 'http://localhost:3000/sessions/analyze'],
    ['a relative path', `/sessions/${SESSION_ID}`],
    ['a string that is not a url', 'nonsense'],
  ])('returns null for %s', (_label, url) => {
    expect(sessionIdFromUrl(url)).toBeNull();
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

  it('sends the token of the session a remembered code points to', () => {
    rememberSessionCode(SESSION_CODE, SESSION_ID);
    setToken(SESSION_ID, auth);

    expect(authHeader(`/sessions/join/${SESSION_CODE}`)).toEqual({
      authorization: 'Bearer token-1',
    });
  });

  it('reads a lowercase code back as the same session', () => {
    rememberSessionCode(SESSION_CODE, SESSION_ID);
    setToken(SESSION_ID, auth);

    expect(authHeader(`/sessions/join/${SESSION_CODE.toLowerCase()}`)).toEqual({
      authorization: 'Bearer token-1',
    });
  });

  it('sends no other session token when the code is unknown', () => {
    setToken(SESSION_ID, auth);

    expect(authHeader('/sessions/join/WXYZ6789')).toBeUndefined();
  });

  it('sends nothing when the remembered session has no token', () => {
    rememberSessionCode(SESSION_CODE, SESSION_ID);

    expect(authHeader(`/sessions/join/${SESSION_CODE}`)).toBeUndefined();
  });
});
