import { google } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { z } from 'zod';

const MODEL = Bun.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite';
const MAX_ATTEMPTS = Number(Bun.env.RECEIPT_EXTRACTION_MAX_ATTEMPTS ?? 3);
const SUM_TOLERANCE_CENTS = 0;

const toTitleCase = (name: string): string =>
  name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(
      /(?<![\p{L}\p{M}'’])\p{L}[\p{L}\p{M}]*/gu,
      (word) => word[0].toUpperCase() + word.slice(1),
    );

const toCurrencyCode = (code: string): string => {
  const trimmed = code.trim();
  return /^[A-Za-z]{3}$/.test(trimmed) ? trimmed.toUpperCase() : 'EUR';
};

export const receiptSchema = z.object({
  merchant: z
    .string()
    .transform(toTitleCase)
    .nullable()
    .describe('Merchant/business name, or null if illegible'),
  date: z.iso
    .date()
    .nullable()
    .catch(null)
    .describe('Receipt date as ISO 8601 (YYYY-MM-DD), or null if not present'),
  currency: z
    .string()
    .transform(toCurrencyCode)
    .describe('ISO 4217 currency code, e.g. EUR. Default to EUR if unknown'),
  totalCents: z
    .number()
    .int()
    .min(0)
    .describe('Bill total in integer cents (e.g. 42.30 EUR -> 4230)'),
  lineItems: z
    .array(
      z.object({
        name: z
          .string()
          .transform(toTitleCase)
          .describe('Item name as printed on the receipt'),
        quantity: z
          .number()
          .int()
          .min(0)
          .describe('Number of units for this line'),
        unitPriceCents: z
          .number()
          .int()
          .min(0)
          .describe('Price per unit in integer cents'),
        lineTotalCents: z
          .number()
          .int()
          .min(0)
          .describe('Line total in integer cents (quantity * unit price)'),
        aiConfidence: z
          .number()
          .min(0)
          .max(1)
          .describe(
            'Confidence for this line between 0 and 1; lower when text/price is unclear',
          ),
      }),
    )
    .describe('One entry per receipt line'),
});

export type ExtractedReceipt = z.infer<typeof receiptSchema>;

export const isReceiptConsistent = (receipt: ExtractedReceipt): boolean => {
  if (receipt.lineItems.length === 0 || receipt.totalCents <= 0) return false;

  let sum = 0;
  for (const item of receipt.lineItems) {
    if (item.quantity * item.unitPriceCents !== item.lineTotalCents)
      return false;
    sum += item.lineTotalCents;
  }

  return Math.abs(sum - receipt.totalCents) <= SUM_TOLERANCE_CENTS;
};

export const receiptScore = (receipt: ExtractedReceipt): number => {
  if (receipt.lineItems.length === 0 || receipt.totalCents <= 0) return 0;

  let sum = 0;
  let matchingLines = 0;
  let confidenceSum = 0;
  for (const item of receipt.lineItems) {
    if (item.quantity * item.unitPriceCents === item.lineTotalCents)
      matchingLines += 1;
    sum += item.lineTotalCents;
    confidenceSum += item.aiConfidence;
  }

  const lineRatio = matchingLines / receipt.lineItems.length;
  const totalError = Math.abs(sum - receipt.totalCents) / receipt.totalCents;
  const avgConfidence = confidenceSum / receipt.lineItems.length;

  return lineRatio * 100 + (1 - Math.min(totalError, 1)) * 10 + avgConfidence;
};

const PROMPT = `You are extracting structured data from a photo of a bar/restaurant receipt.
Return every line item you can read, with quantity, unit price and line total.
All monetary amounts MUST be integer cents (multiply the printed amount by 100, no decimals).
Use the receipt's currency; if you cannot tell, use "EUR".
For each line, set aiConfidence between 0 and 1 — lower it when the text or price is blurry, ambiguous or partially cut off.
If the merchant name or date is illegible, return null for that field.`;

export type ExtractReceipt = (
  imageBytes: Uint8Array,
  mediaType: string,
) => Promise<ExtractedReceipt>;

export const extractReceipt: ExtractReceipt = async (imageBytes, mediaType) => {
  let best: ExtractedReceipt | undefined;
  let bestScore = -Infinity;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { output } = await generateText({
      model: google(MODEL),
      output: Output.object({ schema: receiptSchema }),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'file', mediaType, data: imageBytes },
          ],
        },
      ],
    });

    if (isReceiptConsistent(output)) return output;

    const score = receiptScore(output);
    if (score > bestScore) {
      best = output;
      bestScore = score;
    }
  }

  if (!best) throw new Error('Receipt extraction produced no output');
  return best;
};
