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

export const SessionModel = {
  analyzeBody: t.Object({
    image: t.File({ type: 'image', maxSize: '10m' }),
  }),
  draftSessionResponse: sessionView,
  analysisFailed: t.Literal('Receipt analysis failed'),
  draftCreationFailed: t.Literal('Failed to create draft session'),
} as const;

export type SessionModel = {
  [K in keyof typeof SessionModel]: (typeof SessionModel)[K]['static'];
};
