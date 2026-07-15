import { Elysia, status, t } from 'elysia';
import { gcsReceiptStorage } from '../../storage/gcs';

export const receiptModule = new Elysia({ prefix: '/receipts' }).get(
  '/:fileId',
  async ({ params: { fileId } }) => {
    const file = await gcsReceiptStorage.get(fileId);
    if (!file) return status(404, 'Not found');

    // Node Buffer -> Uint8Array backed by a plain ArrayBuffer, so it satisfies
    // the DOM `BodyInit` type (BufferSource requires an ArrayBuffer, not the
    // ArrayBufferLike that Buffer carries).
    return new Response(Uint8Array.from(file.bytes), {
      headers: { 'content-type': file.mediaType },
    });
  },
  {
    params: t.Object({ fileId: t.String() }),
    detail: { summary: 'Serve a stored receipt image' },
  },
);
