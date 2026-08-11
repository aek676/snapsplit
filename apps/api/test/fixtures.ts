import type { ExtractedReceipt, ExtractReceipt } from '../src/ai/receipt';
import type { ObjectStorage } from '../src/storage/object-storage';

export const extracted: ExtractedReceipt = {
  merchant: 'Bar Paco',
  date: '2026-07-07',
  currency: 'EUR',
  totalCents: 600,
  lineItems: [
    {
      name: 'Caña',
      quantity: 3,
      unitPriceCents: 200,
      lineTotalCents: 600,
      aiConfidence: 0.94,
    },
  ],
};

const PNG_BYTES = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ),
);

export const imageFile = (type = 'image/png') =>
  new File([PNG_BYTES], 'receipt.png', { type });

export function analyzeRequest(file = imageFile()) {
  const form = new FormData();
  form.append('image', file);
  return new Request('http://localhost/sessions/analyze', {
    method: 'POST',
    body: form,
  });
}

export const fakeExtract: ExtractReceipt = async () => extracted;

export function fakeStorage(): ObjectStorage {
  return {
    save: async () => {},
    get: async () => null,
    delete: async () => {},
  };
}
