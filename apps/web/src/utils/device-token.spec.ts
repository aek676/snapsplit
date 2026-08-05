import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToken, getToken, setToken } from '@/utils/device-token';

const keyFor = (sessionId: string) => `snapsplit.dt.${sessionId}`;

const auth = (suffix: string) => ({
  participantId: `participant-${suffix}`,
  token: `token-${suffix}`,
});

/** Storage blocked by cookie policy: the property access itself throws. */
function blockStorage() {
  const original =
    Object.getOwnPropertyDescriptor(window, 'localStorage') ??
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'localStorage');

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
    expect(getToken('unknown')).toBeNull();
  });

  it('returns the token stored for that session', () => {
    setToken('session-a', auth('a'));

    expect(getToken('session-a')).toEqual(auth('a'));
  });
});

describe('setToken', () => {
  it('keeps one token per session instead of overwriting', () => {
    setToken('session-a', auth('a'));
    setToken('session-b', auth('b'));

    expect(getToken('session-a')).toEqual(auth('a'));
    expect(getToken('session-b')).toEqual(auth('b'));
  });

  it('replaces the token when the same session is reissued', () => {
    setToken('session-a', auth('old'));
    setToken('session-a', auth('new'));

    expect(getToken('session-a')).toEqual(auth('new'));
  });

  it('records when the token was issued', () => {
    setToken('session-a', auth('a'));

    const stored = JSON.parse(localStorage.getItem(keyFor('session-a')) ?? '');
    expect(stored.savedAt).toBeTypeOf('number');
  });
});

describe('clearToken', () => {
  it('removes only the token of that session', () => {
    setToken('session-a', auth('a'));
    setToken('session-b', auth('b'));

    clearToken('session-a');

    expect(getToken('session-a')).toBeNull();
    expect(getToken('session-b')).toEqual(auth('b'));
  });

  it('is a no-op when there is nothing stored', () => {
    expect(() => clearToken('unknown')).not.toThrow();
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
    localStorage.setItem(keyFor('session-a'), raw);

    expect(getToken('session-a')).toBeNull();
  });

  it('does not take down a healthy session', () => {
    localStorage.setItem(keyFor('session-a'), '{not json');
    setToken('session-b', auth('b'));

    expect(getToken('session-a')).toBeNull();
    expect(getToken('session-b')).toEqual(auth('b'));
  });
});

describe('when storage is unavailable', () => {
  it('degrades to no token instead of throwing', () => {
    const restore = blockStorage();

    try {
      expect(getToken('session-a')).toBeNull();
      expect(() => setToken('session-a', auth('a'))).not.toThrow();
      expect(() => clearToken('session-a')).not.toThrow();
    } finally {
      restore();
    }
  });

  it('survives a full quota on write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded.', 'QuotaExceededError');
    });

    expect(() => setToken('session-a', auth('a'))).not.toThrow();
  });
});