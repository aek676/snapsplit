import { Elysia, status, t } from 'elysia';
import { gcsReceiptStorage } from '../../storage/gcs';
import { SUPPORTED_IMAGE_MIME_TYPES } from '../../storage/receipt-storage';

const receiptImageContent = Object.fromEntries(
  SUPPORTED_IMAGE_MIME_TYPES.map((type) => [
    type,
    { schema: { type: 'string' as const, format: 'binary' as const } },
  ]),
);

export const receiptModule = new Elysia({
  prefix: '/receipts',
  name: 'receipt',
}).get(
  '/:fileId',
  async ({ params: { fileId } }) => {
    const file = await gcsReceiptStorage.get(fileId);
    if (!file) return status(404, 'Not found');

    return new Response(new Uint8Array(file.bytes), {
      headers: { 'content-type': file.mediaType },
    });
  },
  {
    params: t.Object({ fileId: t.String() }),
    detail: {
      summary: 'Serve a stored receipt image',
      tags: ['Receipts'],
      responses: {
        200: {
          description: 'The stored receipt image bytes',
          content: receiptImageContent,
        },
        404: {
          description: 'No receipt image exists for the given fileId',
          content: { 'text/plain': { schema: { type: 'string' } } },
        },
      },
    },
  },
);
