import { DefaultContext, type Generator, rateLimit } from 'elysia-rate-limit';
import { SessionModel } from '../modules/session/model';

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

const UNKNOWN_CLIENT = 'unknown';

// TRUST_PROXY counts the proxies in front of the API rather than acting as a
// boolean, because platforms disagree on where the client sits in
// x-forwarded-for: appending proxies (nginx, ALB, Cloudflare) leave it as the
// last entry, while Fly.io and Google's HTTP(S) load balancer add their own
// address after it. Each trusted hop moves the client one entry further from
// the right; a header with fewer entries than that falls back to the peer.
export function createClientKey(trustedHops: number): Generator {
  return (request, server) => {
    if (trustedHops > 0) {
      const forwarded = request.headers
        .get('x-forwarded-for')
        ?.split(',')
        .map((hop) => hop.trim())
        .filter(Boolean)
        .at(-trustedHops);
      if (forwarded) return forwarded;
    }

    return server?.requestIP(request)?.address ?? UNKNOWN_CLIENT;
  };
}

const trustedHops = Number(Bun.env.TRUST_PROXY);
const clientKey = createClientKey(
  Number.isInteger(trustedHops) && trustedHops > 0 ? trustedHops : 0,
);

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
