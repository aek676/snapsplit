import { Elysia, status, t } from 'elysia';
import { receiptStorage } from '../../storage';
import type { ObjectStorage } from '../../storage/object-storage';
import { SUPPORTED_IMAGE_MIME_TYPES } from '../../storage/object-storage';
import { RECEIPT_BASE_PATH, RECEIPT_FILE_ID_PATTERN } from './service';

const receiptImageContent = Object.fromEntries(
  SUPPORTED_IMAGE_MIME_TYPES.map((type) => [
    type,
    { schema: { type: 'string' as const, format: 'binary' as const } },
  ]),
);

export function createReceiptModule(storage: ObjectStorage) {
  return new Elysia({
    prefix: RECEIPT_BASE_PATH,
    name: 'receipt',
  }).get(
    '/:fileId',
    async ({ params: { fileId } }) => {
      const file = await storage.get(fileId);
      if (!file) return status(404, 'Not found');

      return new Response(new Uint8Array(file.bytes), {
        headers: {
          'content-type': file.mediaType,
          'cache-control': 'private, max-age=31536000, immutable',
        },
      });
    },
    {
      params: t.Object({
        fileId: t.String({ pattern: RECEIPT_FILE_ID_PATTERN }),
      }),
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
}

export const receiptModule = createReceiptModule(receiptStorage);
