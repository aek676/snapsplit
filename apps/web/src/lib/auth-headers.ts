import { getToken } from '@/utils/device-token';
import { isObjectId } from '@/utils/object-id';

const SESSION_PATH = /^\/sessions\/([^/]+)/;

export function sessionIdFromPath(path: string): string | null {
  const candidate = SESSION_PATH.exec(path)?.[1];
  if (!candidate || !isObjectId(candidate)) return null;

  return candidate;
}

export function authHeader(path: string): Record<string, string> | undefined {
  const sessionId = sessionIdFromPath(path);
  if (!sessionId) return undefined;

  const auth = getToken(sessionId);
  if (!auth) return undefined;

  return { authorization: `Bearer ${auth.token}` };
}
