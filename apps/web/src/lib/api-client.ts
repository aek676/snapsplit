import { type Treaty, treaty } from '@elysiajs/eden';
import type { App } from '@repo/api';
import { toast } from 'shadcn-ui/toast';
import { env } from '@/config/env';

export const api: Treaty.Create<App> = treaty<App>(env.apiUrl, {
  async onResponse(response) {
    if (!response.ok) {
      let message = response.statusText;

      try {
        const errorData = await response.clone().json();
        message = errorData.message || errorData.value?.message || message;
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
  const err = new Error(message);
  if (error instanceof Error) {
    err.cause = error;
  }
  return err;
}
