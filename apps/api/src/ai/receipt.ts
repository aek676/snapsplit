import { google } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { z } from 'zod';

export const receiptSchema = z.object({
  merchant: z
    .string()
    .nullable()
    .describe('Merchant/business name, or null if illegible'),
  date: z.iso
    .date()
    .nullable()
    .catch(null)
    .describe('Receipt date as ISO 8601 (YYYY-MM-DD), or null if not present'),
  currency: z
    .string()
    .describe('ISO 4217 currency code, e.g. EUR. Default to EUR if unknown'),
  totalCents: z
    .number()
    .int()
    .min(0)
    .describe('Bill total in integer cents (e.g. 42.30 EUR -> 4230)'),
  lineItems: z
    .array(
      z.object({
        name: z.string().describe('Item name as printed on the receipt'),
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

const MODEL = Bun.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite';

const PROMPT = `You are extracting structured data from a photo of a bar/restaurant receipt.
Return every line item you can read, with quantity, unit price and line total.
All monetary amounts MUST be integer cents (multiply the printed amount by 100, no decimals).
Use the receipt's currency; if you cannot tell, use "EUR".
For each line, set aiConfidence between 0 and 1 — lower it when the text or price is blurry, ambiguous or partially cut off.
If the merchant name or date is illegible, return null for that field.`;

/**
 * Signature used by the session service. Kept as a standalone type so it can be
 * dependency-injected (and stubbed in tests without hitting the network).
 */
export type ExtractReceipt = (
  imageBytes: Uint8Array,
  mediaType: string,
) => Promise<ExtractedReceipt>;

export const extractReceipt: ExtractReceipt = async (imageBytes, mediaType) => {
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

  return output;
};
