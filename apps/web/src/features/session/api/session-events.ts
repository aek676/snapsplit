import {
  experimental_streamedQuery as streamedQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  getSessionQueryOptions,
  sessionMutationKey,
} from '@/features/session/api/get-session';
import { streamApi } from '@/lib/api-client';
import { expireSession } from '@/lib/auth';

const MAX_RETRY_DELAY_MS = 15_000;
// The server heartbeats every 15s; a silent stream three times that long means
// the connection died without an error (e.g. the phone switched networks).
const STALL_TIMEOUT_MS = 45_000;

/** Stops the retry loop on 401 while `expireSession` navigates away. */
class SessionExpiredError extends Error {}

const sessionEventsQueryKey = (sessionId: string) => [
  'session-events',
  sessionId,
];

/**
 * Consumes the session's SSE stream, calling `onUpdate` on every `update`
 * event. Yields nothing: the events only signal staleness, they are not data.
 * A watchdog aborts the connection when it goes silent for longer than three
 * heartbeats; TanStack's signal aborts it on unmount or cancellation.
 */
async function* sessionEvents(
  sessionId: string,
  signal: AbortSignal,
  onUpdate: () => void,
) {
  const controller = new AbortController();
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  const resetStallTimer = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => controller.abort(), STALL_TIMEOUT_MS);
  };

  try {
    resetStallTimer();
    const { data, error, response, status } = await streamApi
      .sessions({ sessionId })
      .events.get({
        fetch: { signal: AbortSignal.any([signal, controller.signal]) },
      });

    if (status === 401 && response && expireSession(response.url))
      throw new SessionExpiredError();
    if (error) throw new Error(`Event stream failed with status ${status}`);

    for await (const message of data) {
      resetStallTimer();
      if (message.event === 'update') onUpdate();
    }
  } finally {
    clearTimeout(stallTimer);
  }
}

/**
 * Subscribes to the session's SSE stream and invalidates the session query on
 * every `update` event. The subscription is a `streamedQuery`: a dropped
 * stream rejects and reconnects through the retry loop with backoff, while a
 * cleanly closed one resolves and is revived by `refetchInterval`, which is a
 * no-op as long as a stream is in flight.
 */
export function useSessionEvents(sessionId: string, enabled: boolean) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    if (queryClient.isMutating({ mutationKey: sessionMutationKey(sessionId) }))
      return;

    queryClient.invalidateQueries({
      queryKey: getSessionQueryOptions(sessionId).queryKey,
    });
  };

  useQuery({
    queryKey: sessionEventsQueryKey(sessionId),
    enabled,
    gcTime: 0,
    // Revives a cleanly closed stream; stops after a 401 so an expired
    // session is not re-polled forever.
    refetchInterval: (query) =>
      query.state.status === 'error' ? false : MAX_RETRY_DELAY_MS,
    retry: (_, error) => !(error instanceof SessionExpiredError),
    // The failure count only resets when a stream closes cleanly, so clamp
    // the exponent instead of letting the delay overflow. Half the delay is
    // random so that every client of a dropped session does not reconnect in
    // lockstep.
    retryDelay: (failureCount) => {
      const delay = Math.min(
        1000 * 2 ** Math.min(failureCount, 4),
        MAX_RETRY_DELAY_MS,
      );

      return delay / 2 + Math.random() * (delay / 2);
    },
    queryFn: streamedQuery({
      // Destructure `signal` here (not inside the generator) so TanStack
      // marks it consumed and aborts the stream on unmount.
      streamFn: ({ signal }) => sessionEvents(sessionId, signal, invalidate),
    }),
  });

  // Disabling a query does not cancel its in-flight fetch, and the session
  // closes while the component stays mounted — cut the stream explicitly.
  useEffect(() => {
    if (enabled) return;

    void queryClient.cancelQueries({
      queryKey: sessionEventsQueryKey(sessionId),
    });
  }, [enabled, sessionId, queryClient]);
}
