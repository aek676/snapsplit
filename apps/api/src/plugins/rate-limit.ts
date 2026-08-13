import { DefaultContext, type Generator, rateLimit } from 'elysia-rate-limit';
import { SessionModel } from '../modules/session/model';

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

const UNKNOWN_CLIENT = 'unknown';

export function createClientKey(trustProxy: boolean): Generator {
  return (request, server) => {
    if (trustProxy) {
      const forwarded = request.headers
        .get('x-forwarded-for')
        ?.split(',')
        .at(-1)
        ?.trim();
      if (forwarded) return forwarded;
    }

    return server?.requestIP(request)?.address ?? UNKNOWN_CLIENT;
  };
}

const clientKey = createClientKey(Bun.env.TRUST_PROXY === '1');

export const joinRateLimitContext = new DefaultContext();

const JOIN_PATH = /^\/sessions\/join\//;

function isJoinAttempt(request: Request) {
  return (
    request.method === 'POST' && JOIN_PATH.test(new URL(request.url).pathname)
  );
}

export const joinRateLimit = rateLimit({
  duration: WINDOW_MS,
  max: MAX_ATTEMPTS,
  scoping: 'scoped',
  generator: clientKey,
  context: joinRateLimitContext,
  countFailedRequest: true,
  skip: (request) => !isJoinAttempt(request),
  errorResponse: SessionModel.tooManyJoinAttempts.const,
});
