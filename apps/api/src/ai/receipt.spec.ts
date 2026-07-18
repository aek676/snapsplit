import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { MockLanguageModelV4 } from 'ai/test';
import type { ExtractedReceipt } from './receipt';

const consistent: ExtractedReceipt = {
  merchant: 'Bar Paco',
  date: '2026-07-07',
  currency: 'EUR',
  totalCents: 950,
  lineItems: [
    {
      name: 'Caña',
      quantity: 3,
      unitPriceCents: 200,
      lineTotalCents: 600,
      aiConfidence: 0.94,
    },
    {
      name: 'Tapa',
      quantity: 1,
      unitPriceCents: 350,
      lineTotalCents: 350,
      aiConfidence: 0.4,
    },
  ],
};

const lineItem = (
  overrides: Partial<ExtractedReceipt['lineItems'][number]> = {},
): ExtractedReceipt['lineItems'][number] => ({
  ...consistent.lineItems[0],
  ...overrides,
});

const generateResult = (raw: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(raw) }],
  finishReason: { unified: 'stop' as const, raw: 'stop' },
  usage: {
    inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 0, text: 0, reasoning: 0 },
  },
  warnings: [],
});

let model: MockLanguageModelV4;
const google = mock(() => model);
mock.module('@ai-sdk/google', () => ({ google }));

const { extractReceipt, isReceiptConsistent } = await import('./receipt');

const withOutputs = (...raws: unknown[]) => {
  model = new MockLanguageModelV4({
    doGenerate: raws.map((raw) => generateResult(raw)),
  });
};

const extract = () => extractReceipt(new Uint8Array([1]), 'image/jpeg');

describe('isReceiptConsistent', () => {
  it('accepts a receipt whose numbers add up', () => {
    expect(isReceiptConsistent(consistent)).toBe(true);
  });

  it('rejects a line where quantity * unitPrice !== lineTotal', () => {
    const receipt: ExtractedReceipt = {
      ...consistent,
      totalCents: 950,
      lineItems: [lineItem({ lineTotalCents: 599 }), consistent.lineItems[1]],
    };

    expect(isReceiptConsistent(receipt)).toBe(false);
  });

  it('rejects when the line totals do not sum to the bill total', () => {
    expect(isReceiptConsistent({ ...consistent, totalCents: 1000 })).toBe(
      false,
    );
  });

  it('accepts a zero-amount line as long as the totals still add up', () => {
    const receipt: ExtractedReceipt = {
      ...consistent,
      totalCents: 600,
      lineItems: [
        lineItem({ quantity: 3, unitPriceCents: 200, lineTotalCents: 600 }),
        lineItem({
          name: 'Chupito gratis',
          quantity: 1,
          unitPriceCents: 0,
          lineTotalCents: 0,
        }),
      ],
    };

    expect(isReceiptConsistent(receipt)).toBe(true);
  });

  it('rejects an empty receipt', () => {
    expect(isReceiptConsistent({ ...consistent, lineItems: [] })).toBe(false);
  });

  it('rejects a non-positive total', () => {
    expect(
      isReceiptConsistent({ ...consistent, totalCents: 0, lineItems: [] }),
    ).toBe(false);
  });
});

describe('extractReceipt', () => {
  beforeEach(() => {
    google.mockClear();
  });

  it('returns the first consistent extraction without retrying', async () => {
    withOutputs(consistent);

    const result = await extract();

    expect(result).toEqual(consistent);
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it('retries an inconsistent extraction and returns the next consistent one', async () => {
    withOutputs({ ...consistent, totalCents: 1 }, consistent);

    const result = await extract();

    expect(result).toEqual(consistent);
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it('returns the last best-effort extraction when none are consistent', async () => {
    const last: ExtractedReceipt = { ...consistent, totalCents: 2 };
    withOutputs(
      { ...consistent, totalCents: 1 },
      { ...consistent, totalCents: 1 },
      last,
    );

    const result = await extract();

    expect(result).toEqual(last);
    expect(model.doGenerateCalls).toHaveLength(3);
  });

  it('propagates a model error without extra attempts', async () => {
    model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error('no json');
      },
    });

    expect(extract()).rejects.toThrow('no json');
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it('sends the image bytes and media type as a file part', async () => {
    withOutputs(consistent);
    const bytes = new Uint8Array([4, 5, 6, 7]);

    await extractReceipt(bytes, 'image/png');

    const parts = model.doGenerateCalls[0].prompt[0].content as Array<{
      type: string;
      mediaType?: string;
      data?: { data?: unknown };
    }>;
    const filePart = parts.find((part) => part.type === 'file');

    expect(parts.some((part) => part.type === 'text')).toBe(true);
    expect(filePart?.mediaType).toBe('image/png');
    expect(filePart?.data?.data).toEqual(bytes);
  });
});

describe('receiptSchema parsing (real generateText + Output.object)', () => {
  beforeEach(() => {
    google.mockClear();
  });

  it('parses a valid raw output into a typed receipt', async () => {
    withOutputs(consistent);

    const result = await extract();

    expect(result).toEqual(consistent);
  });

  it('returns null merchant when the receipt has no merchant', async () => {
    withOutputs({ ...consistent, merchant: null });

    const result = await extract();

    expect(result.merchant).toBeNull();
  });

  it('coerces an unparseable date to null via .catch(null)', async () => {
    withOutputs({ ...consistent, date: 'ayer' });

    const result = await extract();

    expect(result.date).toBeNull();
  });

  it('keeps an explicit null date as null', async () => {
    withOutputs({ ...consistent, date: null });

    const result = await extract();

    expect(result.date).toBeNull();
  });
});
