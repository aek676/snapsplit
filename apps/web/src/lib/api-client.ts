import { type Treaty, treaty } from '@elysiajs/eden';
import type { App } from '@repo/api';
import { toast } from 'shadcn-ui/toast';
import { env } from '@/config/env';
import { DeviceTokenStorageError } from '@/utils/device-token';
import { authHeader, expireSession, persistAuth } from './auth';

export const api: Treaty.Create<App> = treaty<App>(env.apiUrl, {
  headers: (path) => authHeader(path),
  async onResponse(response) {
    if (response.ok) {
      if (await persistAuth(response)) return;

      const error = new DeviceTokenStorageError();
      toast.add({ type: 'error', title: 'Error', description: error.message });
      throw error;
    }

    if (response.status === 401 && expireSession(response.url)) return;

    toast.add({
      type: 'error',
      title: 'Error',
      description: await errorMessage(response),
    });
  },
});

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.clone().json();

    return typeof body === 'string'
      ? body
      : (body?.message ?? body?.value?.message ?? response.statusText);
  } catch {
    return response.statusText;
  }
}

export function apiError(error: unknown, message: string): Error {
  return new Error(message, { cause: error });
}
