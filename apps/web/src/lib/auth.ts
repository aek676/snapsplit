import { isObjectId } from '@repo/shared-types';
import { clearToken, getToken } from '@/utils/device-token';

const SESSION_PATH = /^\/sessions\/([^/]+)/;

export function sessionIdFromPath(path: string): string | null {
  const candidate = SESSION_PATH.exec(path)?.[1];
  if (!candidate || !isObjectId(candidate)) return null;

  return candidate;
}

export function sessionIdFromUrl(url: string): string | null {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }

  const start = path.indexOf('/sessions/');
  return start < 0 ? null : sessionIdFromPath(path.slice(start));
}

export function authHeader(path: string): Record<string, string> | undefined {
  const sessionId = sessionIdFromPath(path);
  if (!sessionId) return undefined;

  const auth = getToken(sessionId);
  if (!auth) return undefined;

  return { authorization: `Bearer ${auth.token}` };
}

export function expireSession(url: string): boolean {
  const sessionId = sessionIdFromUrl(url);
  if (!sessionId) return false;
  if (!getToken(sessionId)) return true;

  clearToken(sessionId);
  window.location.assign('/');

  return true;
}
