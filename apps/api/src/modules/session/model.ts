import { t } from 'elysia';

const lineItemView = t.Object({
  id: t.String(),
  name: t.String(),
  quantity: t.Number(),
  unitPriceCents: t.Number(),
  lineTotalCents: t.Number(),
  aiConfidence: t.Number(),
});

const sessionView = t.Object({
  id: t.String(),
  status: t.String(),
  merchant: t.Nullable(t.String()),
  date: t.Nullable(t.String()),
  currency: t.String(),
  totalCents: t.Number(),
  receiptImageUrl: t.String(),
  lineItems: t.Array(lineItemView),
});

const lineItemCreateBody = t.Object({
  name: t.String({ minLength: 1 }),
  quantity: t.Number({ minimum: 0 }),
  unitPriceCents: t.Number({ minimum: 0 }),
});

export const SessionModel = {
  analyzeBody: t.Object({
    image: t.File({ type: 'image', maxSize: '10m' }),
  }),
  sessionParams: t.Object({ sessionId: t.String() }),
  lineItemParams: t.Object({ sessionId: t.String(), lineItemId: t.String() }),
  lineItemCreateBody,
  lineItemUpdateBody: t.Partial(lineItemCreateBody),
  draftSessionResponse: sessionView,
  analysisFailed: t.Literal('Receipt analysis failed'),
  draftCreationFailed: t.Literal('Failed to create draft session'),
  sessionNotFound: t.Literal('Session not found'),
  lineItemNotFound: t.Literal('Line item not found'),
  sessionNotDraft: t.Literal('Session is not editable'),
} as const;

export type SessionModel = {
  [K in keyof typeof SessionModel]: (typeof SessionModel)[K]['static'];
};
