import { Elysia, status, t } from 'elysia';
import { extractReceipt } from '../../ai/receipt';
import { gcsReceiptStorage } from '../../storage/gcs';
import { analyzeBody, draftSessionResponse } from './model';
import { SessionService } from './service';

const service = new SessionService(extractReceipt, gcsReceiptStorage);

export const sessionModule = new Elysia({ prefix: '/sessions' }).post(
  '/analyze',
  async ({ body }) => {
    try {
      return await service.createDraftFromImage(body);
    } catch (error) {
      console.error('Receipt analysis failed:', error);
      return status(502, 'Receipt analysis failed');
    }
  },
  {
    body: analyzeBody,
    response: {
      200: draftSessionResponse,
      502: t.String(),
    },
    detail: {
      summary: 'Analyze a receipt photo and create a draft session',
    },
  },
);
