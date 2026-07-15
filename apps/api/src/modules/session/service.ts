import {
  type ExtractedReceipt,
  type ExtractReceipt,
} from '../../ai/receipt';
import { Session } from '../../schemas';
import type { ReceiptStorage } from '../../storage/receipt-storage';
import type { AnalyzeBody, SessionView } from './model';

/** Minimal structural shape of a session document that {@link toSessionView} reads. */
export interface SessionLike {
  _id: unknown;
  status: string;
  merchant?: string | null;
  date?: Date | null;
  currency: string;
  totalCents?: number | null;
  receiptImageUrl?: string | null;
  lineItems?: Array<{
    _id: unknown;
    name?: string | null;
    quantity?: number | null;
    unitPriceCents?: number | null;
    lineTotalCents?: number | null;
    aiConfidence?: number | null;
  }>;
}

/**
 * Builds the document payload for a draft session from an extracted receipt.
 * No participants are created here: the owner (and their device token) is
 * created later, when they enter the session and identify with a name.
 */
export function buildDraftPayload(
  extracted: ExtractedReceipt,
  receiptImageUrl: string,
) {
  return {
    status: 'draft' as const,
    merchant: extracted.merchant ?? undefined,
    date: extracted.date ? new Date(extracted.date) : undefined,
    currency: extracted.currency,
    totalCents: extracted.totalCents,
    receiptImageUrl,
    participants: [],
    lineItems: extracted.lineItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
      aiConfidence: item.aiConfidence,
    })),
  };
}

/** Maps a Mongoose session document to the plain view returned by the API. */
export function toSessionView(session: SessionLike): SessionView {
  return {
    id: String(session._id),
    status: session.status,
    merchant: session.merchant ?? null,
    date: session.date ? session.date.toISOString().slice(0, 10) : null,
    currency: session.currency,
    totalCents: session.totalCents ?? 0,
    receiptImageUrl: session.receiptImageUrl ?? '',
    lineItems: (session.lineItems ?? []).map((item) => ({
      id: String(item._id),
      name: item.name ?? '',
      quantity: item.quantity ?? 0,
      unitPriceCents: item.unitPriceCents ?? 0,
      lineTotalCents: item.lineTotalCents ?? 0,
      aiConfidence: item.aiConfidence ?? 0,
    })),
  };
}

export class SessionService {
  // Dependencies are injected at the composition root (module index.ts) so this
  // service stays decoupled from concrete implementations and is trivial to test.
  constructor(
    private readonly extract: ExtractReceipt,
    private readonly storage: ReceiptStorage,
  ) { }

  async createDraftFromImage({ image }: AnalyzeBody) {
    const bytes = new Uint8Array(await image.arrayBuffer());

    // Store the image first, then run the AI. If extraction fails, drop the
    // just-stored object so we don't leave orphans behind.
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

    // Cast through unknown: Mongoose's hydrated-document type carries a synthetic
    // `[x: string]: NativeDate` index signature that defeats structural matching,
    // but the runtime shape matches SessionLike.
    return toSessionView(session as unknown as SessionLike);
  }
}
