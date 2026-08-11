import { vi } from 'vitest';

/**
 * Mirrors what Elysia puts on the wire: objects are JSON, string literals go out
 * raw as `text/plain`, and `statusText` stays empty the way it does over HTTP/2.
 */
export function respond(url: string, status: number, body: unknown): Response {
  const isJson = typeof body === 'object' && body !== null;

  const make = (): Response => {
    const response = new Response(
      body === undefined ? null : isJson ? JSON.stringify(body) : String(body),
      {
        status,
        headers: {
          'content-type': isJson
            ? 'application/json'
            : 'text/plain;charset=utf-8',
        },
      },
    );
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

export function failToConnect(error: Error = new TypeError('Failed to fetch')) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw error;
    }),
  );
}
