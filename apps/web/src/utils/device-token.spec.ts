import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToken, getToken, setToken } from '@/utils/device-token';

const keyFor = (sessionId: string) => `snapsplit.dt.${sessionId}`;

/** Session ids are ObjectIds: storage ignores anything else. */
const SESSION_A = '507f1f77bcf86cd799439011';
const SESSION_B = '507f191e810c19729de860ea';
const UNKNOWN_SESSION = '5f8d0d55b54764421b7156da';

const auth = (suffix: string) => ({
  participantId: `participant-${suffix}`,
  token: `token-${suffix}`,
});

/** Storage blocked by cookie policy: the property access itself throws. */
function blockStorage() {
  const original =
    Object.getOwnPropertyDescriptor(window, 'localStorage') ??
    Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(window),
      'localStorage',
    );

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
  });

  return () => {
    if (original) Object.defineProperty(window, 'localStorage', original);
  };
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('getToken', () => {
  it('returns null when the session has no stored token', () => {
    expect(getToken(UNKNOWN_SESSION)).toBeNull();
  });

  it('returns the token stored for that session', () => {
    setToken(SESSION_A, auth('a'));

    expect(getToken(SESSION_A)).toEqual(auth('a'));
  });
});

describe('setToken', () => {
  it('keeps one token per session instead of overwriting', () => {
    setToken(SESSION_A, auth('a'));
    setToken(SESSION_B, auth('b'));

    expect(getToken(SESSION_A)).toEqual(auth('a'));
    expect(getToken(SESSION_B)).toEqual(auth('b'));
  });

  it('replaces the token when the same session is reissued', () => {
    setToken(SESSION_A, auth('old'));
    setToken(SESSION_A, auth('new'));

    expect(getToken(SESSION_A)).toEqual(auth('new'));
  });

  it('records when the token was issued', () => {
    setToken(SESSION_A, auth('a'));

    const stored = JSON.parse(localStorage.getItem(keyFor(SESSION_A)) ?? '');
    expect(stored.savedAt).toBeTypeOf('number');
  });

  it('reports that it persisted the token', () => {
    expect(setToken(SESSION_A, auth('a'))).toBe(true);
  });
});

describe('clearToken', () => {
  it('removes only the token of that session', () => {
    setToken(SESSION_A, auth('a'));
    setToken(SESSION_B, auth('b'));

    clearToken(SESSION_A);

    expect(getToken(SESSION_A)).toBeNull();
    expect(getToken(SESSION_B)).toEqual(auth('b'));
  });

  it('is a no-op when there is nothing stored', () => {
    expect(() => clearToken(UNKNOWN_SESSION)).not.toThrow();
  });
});

describe('unreadable entries', () => {
  it.each([
    ['corrupt JSON', '{not json'],
    ['a JSON value that is not an object', 'true'],
    ['an object missing the token', '{"participantId":"p1"}'],
    ['an object missing the participant', '{"token":"t1"}'],
    ['empty strings', '{"participantId":"","token":""}'],
    ['wrongly typed fields', '{"participantId":1,"token":2}'],
  ])('degrades to null on %s', (_label, raw) => {
    localStorage.setItem(keyFor(SESSION_A), raw);

    expect(getToken(SESSION_A)).toBeNull();
  });

  it('does not take down a healthy session', () => {
    localStorage.setItem(keyFor(SESSION_A), '{not json');
    setToken(SESSION_B, auth('b'));

    expect(getToken(SESSION_A)).toBeNull();
    expect(getToken(SESSION_B)).toEqual(auth('b'));
  });
});

describe('when storage is unavailable', () => {
  it('degrades to no token instead of throwing', () => {
    const restore = blockStorage();

    try {
      expect(getToken(SESSION_A)).toBeNull();
      expect(() => setToken(SESSION_A, auth('a'))).not.toThrow();
      expect(() => clearToken(SESSION_A)).not.toThrow();
    } finally {
      restore();
    }
  });

  it('reports that it could not persist the token', () => {
    const restore = blockStorage();

    try {
      expect(setToken(SESSION_A, auth('a'))).toBe(false);
    } finally {
      restore();
    }
  });

  it('survives a full quota on write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded.', 'QuotaExceededError');
    });

    expect(() => setToken(SESSION_A, auth('a'))).not.toThrow();
    expect(setToken(SESSION_A, auth('a'))).toBe(false);
  });
});

describe('ids that cannot name a session', () => {
  it.each([
    ['a slug', 'session-a'],
    ['non-hex characters', 'zzzzzzzzzzzzzzzzzzzzzzzz'],
    ['too few characters', '507f1f77bcf86cd79943901'],
    ['too many characters', '507f1f77bcf86cd7994390111'],
    ['an empty string', ''],
  ])('writes nothing and reads null for %s', (_label, sessionId) => {
    expect(setToken(sessionId, auth('x'))).toBe(false);

    expect(localStorage.getItem(keyFor(sessionId))).toBeNull();
    expect(getToken(sessionId)).toBeNull();
  });
});
