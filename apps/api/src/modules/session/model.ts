import { t } from 'elysia';

export const analyzeBody = t.Object({
  image: t.File({ type: 'image', maxSize: '10m' }),
});
export type AnalyzeBody = typeof analyzeBody.static;

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
export type SessionView = typeof sessionView.static;

/**
 * Response of the analyze endpoint: the freshly created draft session. No owner
 * or device token yet — those are created when the owner enters the session and
 * identifies with a name (SRS §5).
 */
export const draftSessionResponse = sessionView;
export type DraftSessionResponse = typeof draftSessionResponse.static;
