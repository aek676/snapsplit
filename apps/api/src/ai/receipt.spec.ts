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

const { extractReceipt, isReceiptConsistent, receiptScore, receiptSchema } =
  await import('./receipt');

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

describe('receiptScore', () => {
  it('scores a consistent receipt higher than one with mismatched lines', () => {
    const mismatched: ExtractedReceipt = {
      ...consistent,
      lineItems: [lineItem({ lineTotalCents: 999 }), consistent.lineItems[1]],
    };

    expect(receiptScore(consistent)).toBeGreaterThan(receiptScore(mismatched));
  });

  it('returns 0 for an empty receipt', () => {
    expect(receiptScore({ ...consistent, lineItems: [] })).toBe(0);
  });

  it('returns 0 for a non-positive total', () => {
    expect(receiptScore({ ...consistent, totalCents: 0 })).toBe(0);
  });

  it('breaks arithmetic ties by higher average confidence', () => {
    const moreConfident: ExtractedReceipt = {
      ...consistent,
      lineItems: consistent.lineItems.map((item) => ({
        ...item,
        aiConfidence: 1,
      })),
    };

    expect(receiptScore(moreConfident)).toBeGreaterThan(
      receiptScore(consistent),
    );
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

  it('returns the highest-scoring extraction when none are consistent, not the last', async () => {
    // Attempt 2 has matching lines and a total that is off by 1 cent, so it
    // scores highest even though it is not the last attempt.
    const best: ExtractedReceipt = { ...consistent, totalCents: 951 };
    const last: ExtractedReceipt = {
      ...consistent,
      lineItems: [lineItem({ lineTotalCents: 999 }), consistent.lineItems[1]],
    };
    withOutputs({ ...consistent, totalCents: 1 }, best, last);

    const result = await extract();

    expect(result).toEqual(best);
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

  it('normalizes the merchant name to title case', async () => {
    withOutputs({ ...consistent, merchant: '  BAR   pACO  ' });

    const result = await extract();

    expect(result.merchant).toBe('Bar Paco');
  });

  it('leaves a null merchant untouched by normalization', async () => {
    withOutputs({ ...consistent, merchant: null });

    const result = await extract();

    expect(result.merchant).toBeNull();
  });

  it('normalizes line-item names to title case', async () => {
    withOutputs({
      ...consistent,
      lineItems: [lineItem({ name: 'caña   GRANDE' })],
      totalCents: 600,
    });

    const result = await extract();

    expect(result.lineItems[0].name).toBe('Caña Grande');
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

  it('keeps a valid ISO 8601 date', async () => {
    withOutputs({ ...consistent, date: '2026-07-07' });

    const result = await extract();

    expect(result.date).toBe('2026-07-07');
  });

  it('coerces a non-ISO date format to null', async () => {
    withOutputs({ ...consistent, date: '07/07/2026' });

    const result = await extract();

    expect(result.date).toBeNull();
  });

  it('coerces a date-time string to null (date only is allowed)', async () => {
    withOutputs({ ...consistent, date: '2026-07-07T10:00:00Z' });

    const result = await extract();

    expect(result.date).toBeNull();
  });

  it('coerces an impossible calendar date to null', async () => {
    withOutputs({ ...consistent, date: '2026-13-40' });

    const result = await extract();

    expect(result.date).toBeNull();
  });

  it('falls back to EUR when the currency has too many chars', async () => {
    withOutputs({ ...consistent, currency: 'EUROS' });

    const result = await extract();

    expect(result.currency).toBe('EUR');
  });

  it('falls back to EUR when the currency is too short', async () => {
    withOutputs({ ...consistent, currency: 'EU' });

    const result = await extract();

    expect(result.currency).toBe('EUR');
  });

  it('keeps a valid 3-letter currency code', async () => {
    withOutputs({ ...consistent, currency: 'USD' });

    const result = await extract();

    expect(result.currency).toBe('USD');
  });

  it('falls back to EUR for a non-alphabetic 3-char currency', async () => {
    withOutputs({ ...consistent, currency: '$$$' });

    const result = await extract();

    expect(result.currency).toBe('EUR');
  });

  it('uppercases a lowercase currency code', async () => {
    withOutputs({ ...consistent, currency: 'usd' });

    const result = await extract();

    expect(result.currency).toBe('USD');
  });
});

describe('line item name normalization', () => {
  const rawLine = (name: string) => ({
    name,
    quantity: 1,
    unitPriceCents: 100,
    lineTotalCents: 100,
    aiConfidence: 1,
  });
  const normalizeName = (name: string) =>
    receiptSchema.shape.lineItems.element.parse(rawLine(name)).name;

  it('title-cases an all-caps name', () => {
    expect(normalizeName('COCA COLA')).toBe('Coca Cola');
  });

  it('title-cases a lowercase name', () => {
    expect(normalizeName('cerveza jarra')).toBe('Cerveza Jarra');
  });

  it('normalizes a randomly-cased name', () => {
    expect(normalizeName('cErVeZa DoBLe')).toBe('Cerveza Doble');
  });

  it('leaves an already title-cased name unchanged', () => {
    expect(normalizeName('Patatas Bravas')).toBe('Patatas Bravas');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeName('  caña  ')).toBe('Caña');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeName('patatas   bravas')).toBe('Patatas Bravas');
  });

  it('preserves accents and ñ', () => {
    expect(normalizeName('PIÑA colada')).toBe('Piña Colada');
    expect(normalizeName('NIÑO')).toBe('Niño');
  });

  it('capitalizes on both sides of a hyphen', () => {
    expect(normalizeName('COCA-COLA')).toBe('Coca-Cola');
  });

  it('keeps leading numbers and capitalizes the following word', () => {
    expect(normalizeName('2 CAÑAS')).toBe('2 Cañas');
  });

  it('keeps the possessive s lowercase after an apostrophe', () => {
    expect(normalizeName("PACO'S BAR")).toBe("Paco's Bar");
  });

  it('does not capitalize the letter after an apostrophe', () => {
    expect(normalizeName("McDonald's")).toBe("Mcdonald's");
  });

  it('does not capitalize a multi-letter run after an apostrophe', () => {
    expect(normalizeName("L'OREAL")).toBe("L'oreal");
    expect(normalizeName("BAR L'ANTIC")).toBe("Bar L'antic");
  });

  it('handles multiple apostrophes across words', () => {
    expect(normalizeName("O'BRIEN'S PUB")).toBe("O'brien's Pub");
  });

  it('keeps an empty name empty', () => {
    expect(normalizeName('')).toBe('');
  });

  it('normalizes names end-to-end through extractReceipt', async () => {
    withOutputs({
      ...consistent,
      lineItems: [
        { ...consistent.lineItems[0], name: 'COCA   COLA' },
        { ...consistent.lineItems[1], name: 'patatas bravas' },
      ],
    });

    const result = await extract();

    expect(result.lineItems.map((item) => item.name)).toEqual([
      'Coca Cola',
      'Patatas Bravas',
    ]);
  });
});
