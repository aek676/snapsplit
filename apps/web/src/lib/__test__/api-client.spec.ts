import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api-client';
import { failToConnect, serve } from '@/testing/respond';
import {
  DeviceTokenStorageError,
  getToken,
  setToken,
} from '@/utils/device-token';

const SESSION_ID = '507f1f77bcf86cd799439011';
const NEW_SESSION_ID = '507f191e810c19729de860ea';

const auth = { participantId: 'participant-1', token: 'token-1' };

const toastAdd = vi.hoisted(() => vi.fn());
vi.mock('shadcn-ui/toast', () => ({ toast: { add: toastAdd } }));

let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  assign = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign });

  setToken(SESSION_ID, auth);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  it('reports the literal the API sends as plain text', async () => {
    serve(404, 'Line item not found');

    await api.sessions({ sessionId: SESSION_ID }).get();

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Line item not found' }),
    );
  });

  it('reports a proxy error page as it comes', async () => {
    const page = '<html><body>Bad Gateway</body></html>';
    serve(502, page);

    await api.sessions({ sessionId: SESSION_ID }).get();

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ description: page }),
    );
  });

  it('reports a validation failure as it comes', async () => {
    const body = {
      type: 'validation',
      on: 'body',
      property: '/image',
      message: 'Expected required property',
    };
    serve(422, body);

    await api.sessions({ sessionId: SESSION_ID }).get();

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ description: JSON.stringify(body) }),
    );
  });

  it('reports a failure to reach the server', async () => {
    failToConnect();

    const { error } = await api.sessions({ sessionId: SESSION_ID }).get();

    expect(error?.status).toBe(503);
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "We couldn't reach the server. Check your connection.",
      }),
    );
  });

  it('says nothing when the request was aborted', async () => {
    failToConnect(new DOMException('Aborted', 'AbortError'));

    await api.sessions({ sessionId: SESSION_ID }).get();

    expect(toastAdd).not.toHaveBeenCalled();
  });

  it('reports the body of any other failure', async () => {
    serve(500, { message: 'Something broke' });

    await api.sessions({ sessionId: SESSION_ID }).get();

    expect(getToken(SESSION_ID)).toEqual(auth);
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ description: '{"message":"Something broke"}' }),
    );
  });

  it('says nothing on a response that went through', async () => {
    serve(200, { id: SESSION_ID });

    await api.sessions({ sessionId: SESSION_ID }).get();

    expect(getToken(SESSION_ID)).toEqual(auth);
    expect(toastAdd).not.toHaveBeenCalled();
  });

  it('stores the token a response hands back', async () => {
    serve(200, { id: NEW_SESSION_ID, auth });

    await api.sessions({ sessionId: NEW_SESSION_ID }).get();

    expect(getToken(NEW_SESSION_ID)).toEqual(auth);
    expect(toastAdd).not.toHaveBeenCalled();
  });

  it('fails the call and reports it when the token cannot be stored', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded.', 'QuotaExceededError');
    });
    serve(200, { id: NEW_SESSION_ID, auth });

    const { error } = await api.sessions({ sessionId: NEW_SESSION_ID }).get();

    expect(error?.value).toBeInstanceOf(DeviceTokenStorageError);
    expect(getToken(NEW_SESSION_ID)).toBeNull();
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        description: new DeviceTokenStorageError().message,
      }),
    );
  });
});
