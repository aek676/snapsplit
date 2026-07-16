import {
  type ExtractedReceipt,
  type ExtractReceipt,
} from '../../ai/receipt';
import type { HydratedDocument } from 'mongoose';
import { type LineItem, Session } from '../../schemas';
import type { ReceiptStorage } from '../../storage/receipt-storage';
import type { AnalyzeBody, SessionView } from './model';

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

export function toSessionView(session: HydratedDocument<Session>): SessionView {
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
  ) { }

  async createDraftFromImage({ image }: AnalyzeBody) {
    const bytes = new Uint8Array(await image.arrayBuffer());

    const { id } = await this.storage.save(bytes, image.type);
    let extracted;
    try {
      extracted = await this.extract(bytes, image.type);
    } catch (error) {
      await this.storage.delete(id).catch(() => { });
      throw error;
    }

    const payload = buildDraftPayload(extracted, `/receipts/${id}`);
    const session = await new Session(payload).save();

    return toSessionView(session);
  }
}
