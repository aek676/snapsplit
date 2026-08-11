import { status } from 'elysia';
import type { HydratedDocument } from 'mongoose';
import type { ExtractedReceipt, ExtractReceipt } from '../../ai/receipt';
import { type LineItem, type Participant, Session } from '../../schemas';
import type { ObjectStorage } from '../../storage/object-storage';
import { generateToken, hashToken } from '../auth/service';
import {
  newReceiptFileId,
  receiptFileId,
  receiptUrl,
} from '../receipt/service';
import { SessionModel } from './model';

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

export function toSessionView(
  session: HydratedDocument<Session>,
): SessionModel['draftSessionResponse'] {
  return {
    id: String(session._id),
    status: session.status,
    merchant: session.merchant ?? null,
    date: session.date ? session.date.toISOString().slice(0, 10) : null,
    currency: session.currency,
    totalCents: session.totalCents,
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

  async addLineItem(
    session: HydratedDocument<Session>,
    input: SessionModel['lineItemCreateBody'],
  ) {
    if (session.status !== 'draft')
      return status(409, SessionModel.sessionNotDraft.const);

    const lineTotalCents = input.quantity * input.unitPriceCents;
    session.lineItems.push({
      name: input.name,
      quantity: input.quantity,
      unitPriceCents: input.unitPriceCents,
      lineTotalCents,
      aiConfidence: 1,
    });
    session.totalCents += lineTotalCents;
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
    if (patch.quantity !== undefined || patch.unitPriceCents !== undefined) {
      const previousLineTotalCents = lineItem.lineTotalCents;
      lineItem.lineTotalCents = lineItem.quantity * lineItem.unitPriceCents;
      session.totalCents += lineItem.lineTotalCents - previousLineTotalCents;
    }

    if (
      patch.name !== undefined ||
      patch.quantity !== undefined ||
      patch.unitPriceCents !== undefined
    )
      lineItem.aiConfidence = 1;

    await session.save();
    return toSessionView(session);
  }

  async deleteLineItem(session: HydratedDocument<Session>, lineItemId: string) {
    if (session.status !== 'draft')
      return status(409, SessionModel.sessionNotDraft.const);

    const lineItem = session.lineItems.id(lineItemId);
    if (!lineItem) return status(404, SessionModel.lineItemNotFound.const);

    session.totalCents = Math.max(
      0,
      session.totalCents - lineItem.lineTotalCents,
    );
    session.lineItems.pull(lineItemId);
    await session.save();
    return toSessionView(session);
  }
}
