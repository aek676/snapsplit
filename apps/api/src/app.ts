import { cors } from '@elysiajs/cors';
import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { healthcheckPlugin } from 'elysia-healthcheck';
import mongoose from 'mongoose';
import { parseCorsOrigin } from './config/cors';
import { receiptModule } from './modules/receipt';
import { sessionModule } from './modules/session';

export const app = new Elysia()
  .use(cors({ origin: parseCorsOrigin(Bun.env.CORS_ORIGIN) }))
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
      exclude: { paths: ['/healthz', '/healthz/live', '/healthz/ready'] },
    }),
  )
  .use(sessionModule)
  .use(receiptModule)
  .use(
    healthcheckPlugin({
      checks: {
        readiness: [
          () => ({
            name: 'mongodb',
            healthy: mongoose.connection.readyState === 1,
          }),
        ],
      },
    }),
  )
  .get('/', () => ({ hello: 'snapsplit' }));

export type App = typeof app;
