import type { api } from '@/lib/api-client';

/**
 * Session shape returned by the API. Derived from the Eden client so it stays
 * in sync with the backend `sessionView` schema instead of being duplicated by
 * hand — change the API and this type follows.
 */
export type Session = NonNullable<
  Awaited<ReturnType<ReturnType<typeof api.sessions>['get']>>['data']
>;

export type LineItem = Session['lineItems'][number];

export type Participant = Session['participants'][number];

export type Claim = LineItem['claims'][number];

/** Credentials the API hands out once, when it creates the session. */
export type SessionAuth = NonNullable<
  Awaited<ReturnType<typeof api.sessions.analyze.post>>['data']
>['auth'];
