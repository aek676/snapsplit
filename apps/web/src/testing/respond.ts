import { vi } from 'vitest';

export function respond(url: string, status: number, body: unknown): Response {
  const make = (): Response => {
    const response = new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
    Object.defineProperty(response, 'url', { value: url });
    Object.defineProperty(response, 'clone', { value: make });

    return response;
  };

  return make();
}

export function serve(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => respond(url, status, body)),
  );
}
