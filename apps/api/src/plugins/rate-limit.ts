import { DefaultContext, type Generator, rateLimit } from 'elysia-rate-limit';
import { SessionModel } from '../modules/session/model';

const WINDOW_MS = 60_000;
// Generous enough for a whole table arriving through one WiFi or CGNAT
// address — successful joins and renames spend from the same budget as
// guesses — while still capping enumeration of the 32^8 code space at a
// harmless pace.
const MAX_JOIN_ATTEMPTS = 30;
// Availability reads get their own budget so preflights (and their retries)
// can never starve the join budget of a whole table behind one address. The
// GET answers whether a code exists, so it still needs a cap of its own to
// keep enumeration at the same harmless pace; being idempotent and repeated
// freely by the UI, it affords a looser one.
const MAX_AVAILABILITY_READS = 60;

const ANALYZE_WINDOW_MS = 3_600_000;
const MAX_ANALYZE_ATTEMPTS = 10;

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
export const availabilityRateLimitContext = new DefaultContext();
export const analyzeRateLimitContext = new DefaultContext();

const JOIN_PATH = /^\/sessions\/join\//;

function isJoinAttempt(request: Request) {
  return (
    request.method === 'POST' && JOIN_PATH.test(new URL(request.url).pathname)
  );
}

function isAvailabilityRead(request: Request) {
  return (
    request.method === 'GET' && JOIN_PATH.test(new URL(request.url).pathname)
  );
}

const ANALYZE_PATH = /^\/sessions\/analyze$/;

function isAnalyzeAttempt(request: Request) {
  return (
    request.method === 'POST' &&
    ANALYZE_PATH.test(new URL(request.url).pathname)
  );
}

export const joinRateLimit = rateLimit({
  duration: WINDOW_MS,
  max: MAX_JOIN_ATTEMPTS,
  scoping: 'scoped',
  generator: clientKey,
  context: joinRateLimitContext,
  countFailedRequest: true,
  skip: (request) => !isJoinAttempt(request),
  errorResponse: SessionModel.tooManyJoinAttempts.const,
});

export const availabilityRateLimit = rateLimit({
  duration: WINDOW_MS,
  max: MAX_AVAILABILITY_READS,
  scoping: 'scoped',
  generator: clientKey,
  context: availabilityRateLimitContext,
  countFailedRequest: true,
  skip: (request) => !isAvailabilityRead(request),
  errorResponse: SessionModel.tooManyJoinAttempts.const,
});

export const analyzeRateLimit = rateLimit({
  duration: ANALYZE_WINDOW_MS,
  max: MAX_ANALYZE_ATTEMPTS,
  scoping: 'scoped',
  generator: clientKey,
  context: analyzeRateLimitContext,
  countFailedRequest: true,
  skip: (request) => !isAnalyzeAttempt(request),
  errorResponse: SessionModel.tooManyAnalyzeAttempts.const,
});
