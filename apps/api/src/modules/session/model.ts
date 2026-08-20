import { t } from 'elysia';
import { objectId, sessionCode } from '../../common/model';
import { STATUS, TOTAL_SOURCE, type TotalSource } from '../../schemas';
import { SUPPORTED_IMAGE_MIME_TYPES } from '../../storage/object-storage';
import { SESSION_EVENT_TYPES } from './events';

const status = t.UnionEnum([...STATUS]);
const totalSource = t.UnionEnum([...TOTAL_SOURCE]);

const claimView = t.Object({
  participantId: t.String(),
  units: t.Number(),
});

const participantView = t.Object({
  id: t.String(),
  name: t.Nullable(t.String()),
  isOwner: t.Boolean(),
});

const lineItemView = t.Object({
  id: t.String(),
  name: t.String(),
  quantity: t.Number(),
  unitPriceCents: t.Number(),
  lineTotalCents: t.Number(),
  aiConfidence: t.Number(),
  claims: t.Array(claimView),
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
  closedAt: t.Nullable(t.String({ format: 'date-time' })),
  lineItems: t.Array(lineItemView),
  participants: t.Array(participantView),
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
  sessionAvailabilityResponse: t.Object({
    available: t.Boolean(),
    closed: t.Boolean(),
  }),
  claimBody: t.Object({ units: t.Integer({ minimum: 0 }) }),
  sessionEvent: t.Object({
    type: t.UnionEnum([...SESSION_EVENT_TYPES]),
    at: t.String({ format: 'date-time' }),
  }),
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
  sessionNotOpen: t.Literal('Session is not open'),
  sessionNotFound: t.Literal('Session not found'),
  sessionFull: t.Literal('Session is full'),
  notEnoughUnits: t.Literal('Not enough units available'),
  claimConflict: t.Literal('Claim conflicted, please retry'),
  sessionHasUnassignedUnits: t.Literal('Some units are still unassigned'),
  closeConflict: t.Literal('Close conflicted, please retry'),
  tooManyJoinAttempts: t.Literal(
    'Too many join attempts. Try again in a minute.',
  ),
  tooManyAnalyzeAttempts: t.Literal(
    'Too many receipts analyzed. Try again in an hour.',
  ),
  codeGenerationFailed: t.Literal('Failed to generate a session code'),
} as const;

export type SessionModel = {
  [K in keyof typeof SessionModel]: (typeof SessionModel)[K]['static'];
};
