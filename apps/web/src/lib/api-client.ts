import { type Treaty, treaty } from '@elysiajs/eden';
import type { App } from '@repo/api';
import { toast } from 'shadcn-ui/toast';
import { env } from '@/config/env';
import { authHeader } from './auth-headers';

export const api: Treaty.Create<App> = treaty<App>(env.apiUrl, {
  headers: (path) => authHeader(path),
  async onResponse(response) {
    if (!response.ok) {
      let message = response.statusText;

      try {
        const body = await response.clone().json();
        message =
          typeof body === 'string'
            ? body
            : (body?.message ?? body?.value?.message ?? message);
      } catch {}

      toast.add({
        type: 'error',
        title: 'Error',
        description: message,
      });
    }
  },
});

export function apiError(error: unknown, message: string): Error {
  return new Error(message, { cause: error });
}
