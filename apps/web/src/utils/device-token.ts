import { isObjectId, isSessionCode } from '@repo/shared-types';
import { z } from 'zod';
import type { SessionAuth } from '@/types/session';

const PREFIX = 'snapsplit.dt.';
const CODE_PREFIX = 'snapsplit.code.';

export class DeviceTokenStorageError extends Error {
  constructor() {
    super(
      "We couldn't save this session on this device. Enable site storage in your browser and take the photo again.",
    );
    this.name = 'DeviceTokenStorageError';
  }
}

export const sessionAuthSchema = z.object({
  participantId: z.string().min(1),
  token: z.string().min(1),
}) satisfies z.ZodType<SessionAuth>;

type StoredToken = SessionAuth & { savedAt: number };

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function keyFor(sessionId: string): string | null {
  return isObjectId(sessionId) ? `${PREFIX}${sessionId}` : null;
}

function parse(raw: string | null): SessionAuth | null {
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  return sessionAuthSchema.safeParse(value).data ?? null;
}

export function getToken(sessionId: string): SessionAuth | null {
  const key = keyFor(sessionId);
  if (!key) return null;

  const store = storage();
  if (!store) return null;

  return parse(store.getItem(key));
}

export function setToken(sessionId: string, auth: SessionAuth): boolean {
  const key = keyFor(sessionId);
  if (!key) return false;

  const store = storage();
  if (!store) return false;

  try {
    const entry: StoredToken = { ...auth, savedAt: Date.now() };
    store.setItem(key, JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}

function codeKeyFor(code: string): string | null {
  return isSessionCode(code) ? `${CODE_PREFIX}${code.toUpperCase()}` : null;
}

export function rememberSessionCode(code: string, sessionId: string): void {
  const key = codeKeyFor(code);
  if (!key || !isObjectId(sessionId)) return;

  try {
    storage()?.setItem(key, sessionId);
  } catch {}
}

export function sessionIdForCode(code: string): string | null {
  const key = codeKeyFor(code);
  if (!key) return null;

  const sessionId = storage()?.getItem(key);
  return sessionId && isObjectId(sessionId) ? sessionId : null;
}

export function clearToken(sessionId: string): void {
  const key = keyFor(sessionId);
  if (!key) return;

  const store = storage();
  if (!store) return;

  try {
    store.removeItem(key);
  } catch {}
}
