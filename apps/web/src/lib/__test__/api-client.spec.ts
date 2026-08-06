import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api-client';
import { getToken, setToken } from '@/utils/device-token';

const SESSION_ID = '507f1f77bcf86cd799439011';

const auth = { participantId: 'participant-1', token: 'token-1' };

const toastAdd = vi.hoisted(() => vi.fn());
vi.mock('shadcn-ui/toast', () => ({ toast: { add: toastAdd } }));

/**
 * Eden hands `onResponse` a `clone()` of the response, and a hand-built
 * `Response` has no url for the clone to carry over — only one that came out of
 * `fetch` does. So the url is pinned on both the response and its clones.
 */
function respond(url: string, status: number, body: unknown): Response {
  const make = (): Response => {
    const response = new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
    Object.defineProperty(response, 'url', { value: url });
    Object.defineProperty(response, 'clone', { value: make });

    return response;
  };

  return make();
}

let assign: ReturnType<typeof vi.fn>;

function serve(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => respond(url, status, body)),
  );
}

beforeEach(() => {
  assign = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign });

  setToken(SESSION_ID, auth);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('api client', () => {
  it('drops the token and leaves on a 401, without a toast', async () => {
    serve(401, 'Unauthorized');

    await api.sessions({ sessionId: SESSION_ID }).get();

    expect(getToken(SESSION_ID)).toBeNull();
    expect(assign).toHaveBeenCalledWith('/');
    expect(toastAdd).not.toHaveBeenCalled();
  });

  it('keeps the token on a 403 and reports it', async () => {
    serve(403, 'Forbidden');

    await api.sessions({ sessionId: SESSION_ID }).get();

    expect(getToken(SESSION_ID)).toEqual(auth);
    expect(assign).not.toHaveBeenCalled();
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', description: 'Forbidden' }),
    );
  });

  it('reports a 401 on a route that names no session', async () => {
    serve(401, 'Unauthorized');

    await api.sessions({ sessionId: 'join' }).get();

    expect(getToken(SESSION_ID)).toEqual(auth);
    expect(assign).not.toHaveBeenCalled();
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Unauthorized' }),
    );
  });

  it('reports the message of any other failure', async () => {
    serve(500, { message: 'Something broke' });

    await api.sessions({ sessionId: SESSION_ID }).get();

    expect(getToken(SESSION_ID)).toEqual(auth);
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Something broke' }),
    );
  });

  it('says nothing on a response that went through', async () => {
    serve(200, { id: SESSION_ID });

    await api.sessions({ sessionId: SESSION_ID }).get();

    expect(getToken(SESSION_ID)).toEqual(auth);
    expect(toastAdd).not.toHaveBeenCalled();
  });
});
