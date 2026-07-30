import { status } from 'elysia';
import { type HydratedDocument, Error as MongooseError } from 'mongoose';
import type { ExtractedReceipt, ExtractReceipt } from '../../ai/receipt';
import { type LineItem, Session } from '../../schemas';
import type { ReceiptStorage } from '../../storage/receipt-storage';
import { SessionModel } from './model';

type LineItemInput = Pick<
  LineItem,
  'name' | 'quantity' | 'unitPriceCents' | 'lineTotalCents' | 'aiConfidence'
>;

type SessionDraftInput = Pick<
  Session,
  'status' | 'merchant' | 'date' | 'currency' | 'totalCents' | 'receiptImageUrl'
> & {
  participants: [];
  lineItems: LineItemInput[];
};

export function buildDraftPayload(
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
    participants: [],
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
    private readonly storage: ReceiptStorage,
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

    const { id } = await this.storage.save(bytes, image.type);
    try {
      const payload = buildDraftPayload(extracted, `/receipts/${id}`);
      const session = await new Session(payload).save();
      return toSessionView(session);
    } catch (error) {
      await this.storage.delete(id).catch(() => {});
      console.error('Failed to persist draft session:', error);
      return status(500, SessionModel.draftCreationFailed.const);
    }
  }

  private async findSession(sessionId: string) {
    try {
      return await Session.findById(sessionId);
    } catch (error) {
      if (error instanceof MongooseError.CastError) return null;
      throw error;
    }
  }

  async getSession(sessionId: string) {
    const session = await this.findSession(sessionId);
    if (!session) return status(404, SessionModel.sessionNotFound.const);
    return toSessionView(session);
  }

  async addLineItem(
    sessionId: string,
    input: SessionModel['lineItemCreateBody'],
  ) {
    const session = await this.findSession(sessionId);
    if (!session) return status(404, SessionModel.sessionNotFound.const);
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
    sessionId: string,
    lineItemId: string,
    patch: SessionModel['lineItemUpdateBody'],
  ) {
    const session = await this.findSession(sessionId);
    if (!session) return status(404, SessionModel.sessionNotFound.const);
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
    // An edit means the payer vouched for the line; an empty patch confirms nothing.
    if (
      patch.name !== undefined ||
      patch.quantity !== undefined ||
      patch.unitPriceCents !== undefined
    )
      lineItem.aiConfidence = 1;

    await session.save();
    return toSessionView(session);
  }

  async deleteLineItem(sessionId: string, lineItemId: string) {
    const session = await this.findSession(sessionId);
    if (!session) return status(404, SessionModel.sessionNotFound.const);
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
