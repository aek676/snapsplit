import { t } from 'elysia';
import { objectId, sessionCode } from '../../common/model';
import { STATUS, TOTAL_SOURCE, type TotalSource } from '../../schemas';
import { SUPPORTED_IMAGE_MIME_TYPES } from '../../storage/object-storage';

const status = t.UnionEnum([...STATUS]);
const totalSource = t.UnionEnum([...TOTAL_SOURCE]);

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
  code: t.Nullable(t.String()),
  status,
  merchant: t.Nullable(t.String()),
  date: t.Nullable(t.String()),
  currency: t.String(),
  totalCents: t.Number(),
  totalSource,
  receiptImageUrl: t.String(),
  lineItems: t.Array(lineItemView),
});

const authView = t.Object({
  participantId: t.String(),
  token: t.String(),
});

const sessionUpdateBody = t.Partial(
  t.Object({
    merchant: t.String({ minLength: 1 }),
    date: t.String({ format: 'date' }),
    totalCents: t.Integer({ minimum: 0 }),
    totalSource: t.Literal('items' satisfies TotalSource),
  }),
);

const lineItemCreateBody = t.Object({
  name: t.String({ minLength: 1 }),
  quantity: t.Integer({ minimum: 0 }),
  unitPriceCents: t.Integer({ minimum: 0 }),
});

export const SessionModel = {
  analyzeBody: t.Object({
    image: t.File({ type: [...SUPPORTED_IMAGE_MIME_TYPES], maxSize: '10m' }),
  }),
  sessionParams: t.Object({ sessionId: objectId }),
  sessionUpdateBody,
  lineItemParams: t.Object({ sessionId: objectId, lineItemId: objectId }),
  lineItemCreateBody,
  lineItemUpdateBody: t.Partial(lineItemCreateBody),
  draftSessionResponse: sessionView,
  draftSessionCreatedResponse: t.Composite([
    sessionView,
    t.Object({ auth: authView }),
  ]),
  joinParams: t.Object({ code: sessionCode }),
  joinBody: t.Object({
    name: t.String({ minLength: 1, maxLength: 50 }),
  }),
  joinResponse: t.Composite([
    sessionView,
    t.Object({
      auth: t.Composite([
        t.Pick(authView, ['participantId']),
        t.Partial(t.Pick(authView, ['token'])),
      ]),
    }),
  ]),
  noContent: t.Void(),
  analysisFailed: t.Literal('Receipt analysis failed'),
  draftCreationFailed: t.Literal('Failed to create draft session'),
  internalError: t.Literal('Unexpected server error'),
  lineItemNotFound: t.Literal('Line item not found'),
  sessionNotDraft: t.Literal('Session is not editable'),
  totalPatchConflict: t.Literal(
    'Cannot set a total while it follows the items',
  ),
  sessionEmpty: t.Literal('Session has no items to split'),
  sessionNeedsReview: t.Literal('Some items still need review'),
  sessionTotalMismatch: t.Literal('Items do not add up to the receipt total'),
  sessionNotFound: t.Literal('Session not found'),
  codeGenerationFailed: t.Literal('Failed to generate a session code'),
} as const;

export type SessionModel = {
  [K in keyof typeof SessionModel]: (typeof SessionModel)[K]['static'];
};
