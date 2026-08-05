import { z } from 'zod';
import type { SessionAuth } from '@/types/session';

const PREFIX = 'snapsplit.dt.';

const sessionAuthSchema = z.object({
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

function keyFor(sessionId: string) {
  return `${PREFIX}${sessionId}`;
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
  const store = storage();
  if (!store) return null;

  return parse(store.getItem(keyFor(sessionId)));
}

export function setToken(sessionId: string, auth: SessionAuth): void {
  const store = storage();
  if (!store) return;

  try {
    const entry: StoredToken = { ...auth, savedAt: Date.now() };
    store.setItem(keyFor(sessionId), JSON.stringify(entry));
  } catch {}
}

export function clearToken(sessionId: string): void {
  const store = storage();
  if (!store) return;

  try {
    store.removeItem(keyFor(sessionId));
  } catch {}
}
