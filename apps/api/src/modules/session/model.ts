import { t } from 'elysia';
import { SUPPORTED_IMAGE_MIME_TYPES } from '../../storage/receipt-storage';

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

const authView = t.Object({
  participantId: t.String(),
  token: t.String(),
});

const lineItemCreateBody = t.Object({
  name: t.String({ minLength: 1 }),
  quantity: t.Integer({ minimum: 0 }),
  unitPriceCents: t.Integer({ minimum: 0 }),
});

export const SessionModel = {
  analyzeBody: t.Object({
    image: t.File({ type: [...SUPPORTED_IMAGE_MIME_TYPES], maxSize: '10m' }),
  }),
  sessionParams: t.Object({ sessionId: t.String() }),
  lineItemParams: t.Object({ sessionId: t.String(), lineItemId: t.String() }),
  lineItemCreateBody,
  lineItemUpdateBody: t.Partial(lineItemCreateBody),
  draftSessionResponse: sessionView,
  draftSessionCreatedResponse: t.Composite([
    sessionView,
    t.Object({ auth: authView }),
  ]),
  analysisFailed: t.Literal('Receipt analysis failed'),
  draftCreationFailed: t.Literal('Failed to create draft session'),
  internalError: t.Literal('Unexpected server error'),
  sessionNotFound: t.Literal('Session not found'),
  lineItemNotFound: t.Literal('Line item not found'),
  sessionNotDraft: t.Literal('Session is not editable'),
} as const;

export type SessionModel = {
  [K in keyof typeof SessionModel]: (typeof SessionModel)[K]['static'];
};
