import { type Treaty, treaty } from '@elysiajs/eden';
import type { App } from '@repo/api';
import { toast } from 'shadcn-ui/toast';
import { env } from '@/config/env';
import { DeviceTokenStorageError } from '@/utils/device-token';
import { authHeader, expireSession, persistAuth } from './auth';

const NETWORK_ERROR = "We couldn't reach the server. Check your connection.";

export const api: Treaty.Create<App> = treaty<App>(env.apiUrl, {
  fetcher,
  headers: (path) => authHeader(path),
  async onResponse(response) {
    if (response.ok) {
      if (await persistAuth(response)) return;

      const error = new DeviceTokenStorageError();
      report(error.message);
      throw error;
    }

    if (response.status === 401 && expireSession(response.url)) return;

    report(await response.clone().text());
  },
});

async function fetcher(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError'))
      report(NETWORK_ERROR);

    throw error;
  }
}

function report(description: string): void {
  toast.add({ type: 'error', title: 'Error', description });
}

export function apiError(error: unknown, message: string): Error {
  return new Error(message, { cause: error });
}
