import {
  LOW_CONFIDENCE_THRESHOLD,
  SESSION_CODE_ALPHABET,
  SESSION_CODE_LENGTH,
} from '@repo/shared-types';
import { status } from 'elysia';
import { type HydratedDocument, Types } from 'mongoose';
import type { ExtractedReceipt, ExtractReceipt } from '../../ai/receipt';
import { isDuplicateKeyError } from '../../common/mongo';
import { type LineItem, type Participant, Session } from '../../schemas';
import type { ObjectStorage } from '../../storage/object-storage';
import { generateToken, hashToken } from '../auth/service';
import {
  newReceiptFileId,
  receiptFileId,
  receiptUrl,
} from '../receipt/service';
import { type SessionEvents, sessionEvents } from './events';
import { SessionModel } from './model';

const CODE_ATTEMPTS = 5;
const CLAIM_ATTEMPTS = 3;
// Bounds the session document's growth and the SSE fan-out behind one code.
const MAX_PARTICIPANTS = 30;

export function generateSessionCode() {
  const bytes = new Uint8Array(SESSION_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (byte) => SESSION_CODE_ALPHABET[byte % SESSION_CODE_ALPHABET.length],
  ).join('');
}

type LineItemInput = Pick<
  LineItem,
  'name' | 'quantity' | 'unitPriceCents' | 'lineTotalCents' | 'aiConfidence'
>;

type ParticipantInput = Pick<Participant, 'deviceTokenHash' | 'isOwner'>;

type SessionDraftInput = Pick<
  Session,
  'status' | 'merchant' | 'date' | 'currency' | 'totalCents' | 'receiptImageUrl'
> & {
  participants: ParticipantInput[];
  lineItems: LineItemInput[];
};

export function buildDraftPayload(
  deviceTokenHash: string,
  extracted: ExtractedReceipt,
  receiptImageUrl: string,
): SessionDraftInput {
  return {
    status: 'draft',
    merchant: extracted.merchant ?? undefined,
    date: extracted.date ? new Date(extracted.date) : undefined,
    currency: extracted.currency,
    totalCents: extracted.totalCents,
    receiptImageUrl,
    participants: [{ deviceTokenHash, isOwner: true }],
    lineItems: extracted.lineItems.map(
      (item): LineItemInput => ({
        name: item.name,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        lineTotalCents: item.lineTotalCents,
        aiConfidence: item.aiConfidence,
      }),
    ),
  };
}

export function lineSumCents(session: HydratedDocument<Session>): number {
  return session.lineItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
}

export function claimedUnits(
  lineItem: LineItem,
  excludeParticipantId?: string,
): number {
  return lineItem.claims.reduce(
    (sum, claim) =>
      String(claim.participantId) === excludeParticipantId
        ? sum
        : sum + claim.units,
    0,
  );
}

export function toSessionView(
  session: HydratedDocument<Session>,
): SessionModel['draftSessionResponse'] {
  return {
    id: String(session._id),
    code: session.code ?? null,
    status: session.status,
    merchant: session.merchant ?? null,
    date: session.date ? session.date.toISOString().slice(0, 10) : null,
    currency: session.currency,
    totalCents: session.totalCents,
    totalSource: session.totalSource,
    receiptImageUrl: session.receiptImageUrl,
    lineItems: session.lineItems.map((item) => ({
      id: String(item._id),
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
      aiConfidence: item.aiConfidence,
      claims: item.claims.map((claim) => ({
        participantId: String(claim.participantId),
        units: claim.units,
      })),
    })),
    participants: session.participants.map((participant) => ({
      id: String(participant._id),
      name: participant.name ?? null,
      isOwner: participant.isOwner,
    })),
  };
}

export class SessionService {
  constructor(
    private readonly extract: ExtractReceipt,
    private readonly storage: ObjectStorage,
    private readonly events: SessionEvents = sessionEvents,
  ) {}

  async createDraftFromImage({ image }: SessionModel['analyzeBody']) {
    const bytes = new Uint8Array(await image.arrayBuffer());

    let extracted: ExtractedReceipt;
    try {
      extracted = await this.extract(bytes, image.type);
    } catch (error) {
      console.error('Receipt extraction failed:', error);
      return status(502, SessionModel.analysisFailed.const);
    }

    const fileId = newReceiptFileId(image.type);
    await this.storage.save(fileId, bytes, image.type);
    try {
      const token = generateToken();
      const deviceTokenHash = hashToken(token);
      const payload = buildDraftPayload(
        deviceTokenHash,
        extracted,
        receiptUrl(fileId),
      );
      const session = await new Session(payload).save();
      const [owner] = session.participants;
      return {
        ...toSessionView(session),
        auth: { participantId: String(owner._id), token },
      };
    } catch (error) {
      await this.storage.delete(fileId).catch(() => {});
      console.error('Failed to persist draft session:', error);
      return status(500, SessionModel.draftCreationFailed.const);
    }
  }

  async deleteSession(session: HydratedDocument<Session>) {
    await session.deleteOne();

    const fileId = receiptFileId(session.receiptImageUrl);
    if (fileId) await this.storage.delete(fileId).catch(() => {});

    return status(204, undefined);
  }

  async updateSession(
    session: HydratedDocument<Session>,
    patch: SessionModel['sessionUpdateBody'],
  ) {
    if (session.status !== 'draft')
      return status(409, SessionModel.sessionNotDraft.const);

    if (patch.totalCents !== undefined && patch.totalSource === 'items')
      return status(409, SessionModel.totalPatchConflict.const);

    if (patch.merchant !== undefined) session.merchant = patch.merchant;
    if (patch.date !== undefined) session.date = new Date(patch.date);
    if (patch.totalSource === 'items' || patch.totalCents !== undefined) {
      session.totalSource = patch.totalSource ?? 'receipt';
      session.totalCents = patch.totalCents ?? lineSumCents(session);
    }

    await session.save();
    return toSessionView(session);
  }

  async addLineItem(
    session: HydratedDocument<Session>,
    input: SessionModel['lineItemCreateBody'],
  ) {
    if (session.status !== 'draft')
      return status(409, SessionModel.sessionNotDraft.const);

    session.lineItems.push({
      name: input.name,
      quantity: input.quantity,
      unitPriceCents: input.unitPriceCents,
      lineTotalCents: input.quantity * input.unitPriceCents,
      aiConfidence: 1,
    });

    if (session.totalSource === 'items')
      session.totalCents = lineSumCents(session);

    await session.save();
    return toSessionView(session);
  }

  async updateLineItem(
    session: HydratedDocument<Session>,
    lineItemId: string,
    patch: SessionModel['lineItemUpdateBody'],
  ) {
    if (session.status !== 'draft')
      return status(409, SessionModel.sessionNotDraft.const);

    const lineItem = session.lineItems.id(lineItemId);
    if (!lineItem) return status(404, SessionModel.lineItemNotFound.const);

    if (patch.name !== undefined) lineItem.name = patch.name;
    if (patch.quantity !== undefined) lineItem.quantity = patch.quantity;
    if (patch.unitPriceCents !== undefined)
      lineItem.unitPriceCents = patch.unitPriceCents;
    if (patch.quantity !== undefined || patch.unitPriceCents !== undefined)
      lineItem.lineTotalCents = lineItem.quantity * lineItem.unitPriceCents;

    if (
      patch.name !== undefined ||
      patch.quantity !== undefined ||
      patch.unitPriceCents !== undefined
    )
      lineItem.aiConfidence = 1;

    if (session.totalSource === 'items')
      session.totalCents = lineSumCents(session);

    await session.save();
    return toSessionView(session);
  }

  async deleteLineItem(session: HydratedDocument<Session>, lineItemId: string) {
    if (session.status !== 'draft')
      return status(409, SessionModel.sessionNotDraft.const);

    const lineItem = session.lineItems.id(lineItemId);
    if (!lineItem) return status(404, SessionModel.lineItemNotFound.const);

    session.lineItems.pull(lineItemId);

    if (session.totalSource === 'items')
      session.totalCents = lineSumCents(session);

    await session.save();
    return toSessionView(session);
  }

  async confirmSession(session: HydratedDocument<Session>) {
    if (session.status !== 'draft')
      return status(409, SessionModel.sessionNotDraft.const);

    if (session.lineItems.length === 0)
      return status(409, SessionModel.sessionEmpty.const);

    if (
      session.lineItems.some(
        (item) => item.aiConfidence < LOW_CONFIDENCE_THRESHOLD,
      )
    )
      return status(409, SessionModel.sessionNeedsReview.const);

    if (lineSumCents(session) !== session.totalCents)
      return status(409, SessionModel.sessionTotalMismatch.const);

    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      try {
        const published = await Session.findOneAndUpdate(
          { _id: session._id, status: 'draft' },
          {
            $set: { status: 'open', code: generateSessionCode() },
            $inc: { __v: 1 },
          },
          { returnDocument: 'after' },
        );
        if (!published) return status(409, SessionModel.sessionNotDraft.const);
        return toSessionView(published);
      } catch (error) {
        if (!isDuplicateKeyError(error, 'code')) throw error;
      }
    }

    console.error(
      `Exhausted ${CODE_ATTEMPTS} code attempts for session ${session._id}`,
    );
    return status(500, SessionModel.codeGenerationFailed.const);
  }

  async sessionAvailability(rawCode: string) {
    const exists = await Session.exists({
      code: rawCode.toUpperCase(),
      status: 'open',
    });
    return { available: Boolean(exists) };
  }

  async joinSession(rawCode: string, name: string, callerToken?: string) {
    const code = rawCode.toUpperCase();
    if (callerToken) {
      const callerTokenHash = hashToken(callerToken);
      const session =
        (await Session.findOneAndUpdate(
          {
            code,
            status: 'open',
            'participants.deviceTokenHash': callerTokenHash,
          },
          { $set: { 'participants.$.name': name }, $inc: { __v: 1 } },
          { returnDocument: 'after' },
        ).select('+participants.deviceTokenHash')) ??
        // Only reached when the session is not open, since the update above
        // matches any open session the bearer belongs to. Membership is proven,
        // so the anti-enumeration 404 below is not needed here — but a session
        // that is no longer open is immutable, hence no rename.
        (await Session.findOne({
          code,
          'participants.deviceTokenHash': callerTokenHash,
        }).select('+participants.deviceTokenHash'));

      if (session) {
        const me = session.participants.find(
          (participant) => participant.deviceTokenHash === callerTokenHash,
        );
        if (me) {
          return {
            ...toSessionView(session),
            auth: { participantId: String(me._id) },
          };
        }
      }
    }

    const token = generateToken();
    const deviceTokenHash = hashToken(token);

    const session = await Session.findOneAndUpdate(
      {
        code,
        status: 'open',
        $expr: { $lt: [{ $size: '$participants' }, MAX_PARTICIPANTS] },
      },
      {
        $push: {
          participants: { name, deviceTokenHash, isOwner: false },
        },
        $inc: { __v: 1 },
      },
      { returnDocument: 'after' },
    );

    if (!session) {
      // A full session leaks nothing the public availability read does not
      // already answer, so it may say so.
      const fullSession = await Session.exists({ code, status: 'open' });
      if (fullSession) return status(409, SessionModel.sessionFull.const);

      // To anyone who is not already a participant, a session that exists but
      // is closed answers the same as one that never existed: telling them
      // apart would confirm which codes are real to anyone probing them.
      return status(404, SessionModel.sessionNotFound.const);
    }

    this.events.publish(String(session._id), {
      type: 'participant-joined',
      at: new Date().toISOString(),
    });

    const guest = session.participants[session.participants.length - 1];
    return {
      ...toSessionView(session),
      auth: { participantId: String(guest._id), token },
    };
  }

  async setClaim(
    session: HydratedDocument<Session>,
    participantId: string,
    lineItemId: string,
    units: number,
  ) {
    for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt++) {
      const doc = attempt === 0 ? session : await Session.findById(session._id);
      if (!doc) return status(404, SessionModel.sessionNotFound.const);

      if (doc.status !== 'open')
        return status(409, SessionModel.sessionNotOpen.const);

      const lineItem = doc.lineItems.id(lineItemId);

      if (!lineItem) return status(404, SessionModel.lineItemNotFound.const);

      if (units > lineItem.quantity - claimedUnits(lineItem, participantId))
        return status(409, SessionModel.notEnoughUnits.const);

      const nextClaims = lineItem.claims
        .filter((claim) => String(claim.participantId) !== participantId)
        .map((claim) => ({
          participantId: claim.participantId,
          units: claim.units,
        }));

      if (units > 0)
        nextClaims.push({
          participantId: new Types.ObjectId(participantId),
          units,
        });

      const updated = await Session.findOneAndUpdate(
        { _id: doc._id, status: 'open', __v: doc.__v },
        {
          $set: { 'lineItems.$[item].claims': nextClaims },
          $inc: { __v: 1 },
        },
        {
          arrayFilters: [{ 'item._id': lineItemId }],
          returnDocument: 'after',
        },
      );

      if (updated) {
        this.events.publish(String(updated._id), {
          type: 'claims-updated',
          at: new Date().toISOString(),
        });
        return toSessionView(updated);
      }
    }
    return status(409, SessionModel.claimConflict.const);
  }
}
