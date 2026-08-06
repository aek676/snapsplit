import { isObjectId } from '@repo/shared-types';
import { z } from 'zod';
import type { SessionAuth } from '@/types/session';

const PREFIX = 'snapsplit.dt.';

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

/** Returns whether the token was persisted: without it the session is lost. */
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

export function clearToken(sessionId: string): void {
  const key = keyFor(sessionId);
  if (!key) return;

  const store = storage();
  if (!store) return;

  try {
    store.removeItem(key);
  } catch {}
}
