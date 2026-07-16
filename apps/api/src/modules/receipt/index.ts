import { Elysia, status, t } from 'elysia';
import { gcsReceiptStorage } from '../../storage/gcs';

export const receiptModule = new Elysia({
  prefix: '/receipts',
  name: 'receipt',
}).get(
  '/:fileId',
  async ({ params: { fileId } }) => {
    const file = await gcsReceiptStorage.get(fileId);
    if (!file) return status(404, 'Not found');

    return new Response(Uint8Array.from(file.bytes), {
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
          content: {
            'image/jpeg': { schema: { type: 'string', format: 'binary' } },
            'image/png': { schema: { type: 'string', format: 'binary' } },
            'image/webp': { schema: { type: 'string', format: 'binary' } },
            'image/gif': { schema: { type: 'string', format: 'binary' } },
          },
        },
        404: {
          description: 'No receipt image exists for the given fileId',
          content: { 'text/plain': { schema: { type: 'string' } } },
        },
      },
    },
  },
);
