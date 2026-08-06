import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expireSession } from '@/lib/auth';
import { getToken, setToken } from '@/utils/device-token';

const SESSION_ID = '507f1f77bcf86cd799439011';
const OTHER_SESSION_ID = '507f1f77bcf86cd799439022';
const API = 'http://localhost:3000';

const auth = { participantId: 'participant-1', token: 'token-1' };

let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  assign = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign });
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('expireSession', () => {
  it.each([
    ['the session itself', `${API}/sessions/${SESSION_ID}`],
    ['a nested resource', `${API}/sessions/${SESSION_ID}/line-items`],
    ['a nested resource id', `${API}/sessions/${SESSION_ID}/line-items/abc`],
  ])('drops the token and leaves on %s', (_label, url) => {
    setToken(SESSION_ID, auth);

    expect(expireSession(url)).toBe(true);
    expect(getToken(SESSION_ID)).toBeNull();
    expect(assign).toHaveBeenCalledWith('/');
  });

  it('keeps the tokens of the other sessions', () => {
    setToken(SESSION_ID, auth);
    setToken(OTHER_SESSION_ID, auth);

    expireSession(`${API}/sessions/${SESSION_ID}`);

    expect(getToken(OTHER_SESSION_ID)).toEqual(auth);
  });

  it.each([
    ['a route that names no session', `${API}/sessions/analyze`],
    ['a segment that is not an ObjectId', `${API}/sessions/join`],
    ['another resource', `${API}/receipts/abc`],
    ['a url it cannot parse', `/sessions/${SESSION_ID}`],
  ])('reports %s as unhandled and stays put', (_label, url) => {
    setToken(SESSION_ID, auth);

    expect(expireSession(url)).toBe(false);
    expect(getToken(SESSION_ID)).toEqual(auth);
    expect(assign).not.toHaveBeenCalled();
  });

  it('leaves once when several requests fail together', () => {
    setToken(SESSION_ID, auth);

    expect(expireSession(`${API}/sessions/${SESSION_ID}`)).toBe(true);
    expect(expireSession(`${API}/sessions/${SESSION_ID}/line-items`)).toBe(
      true,
    );

    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('treats a session it holds no token for as handled, without leaving', () => {
    expect(expireSession(`${API}/sessions/${SESSION_ID}`)).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });
});
