import { LOW_CONFIDENCE_THRESHOLD } from '@repo/shared-types';
import { status } from 'elysia';
import type { HydratedDocument } from 'mongoose';
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
import { SessionModel } from './model';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const CODE_ATTEMPTS = 5;

export function generateSessionCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length],
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
    })),
  };
}

export class SessionService {
  constructor(
    private readonly extract: ExtractReceipt,
    private readonly storage: ObjectStorage,
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
          { $set: { status: 'open', code: generateSessionCode() } },
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
}
