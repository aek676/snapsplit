import { cors } from '@elysiajs/cors';
import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { receiptModule } from './modules/receipt';
import { sessionModule } from './modules/session';

export const app = new Elysia()
  .use(cors())
  .use(
    openapi({
      documentation: {
        info: {
          title: 'SnapSplit API',
          version: '1.0.0',
          description:
            'Split a bar/restaurant bill from a photo of the receipt.',
        },
        tags: [
          { name: 'Sessions', description: 'Receipt analysis and sessions' },
          { name: 'Receipts', description: 'Stored receipt images' },
        ],
      },
    }),
  )
  .use(sessionModule)
  .use(receiptModule)
  .get('/', () => ({ hello: 'snapsplit' }));

export type App = typeof app;

export {
  EXT_BY_MEDIA_TYPE,
  SUPPORTED_IMAGE_MIME_TYPES,
  type SupportedImageMimeType,
} from './storage/object-storage';
