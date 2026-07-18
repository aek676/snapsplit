import { Elysia } from 'elysia';
import { extractReceipt } from '../../ai/receipt';
import { gcsReceiptStorage } from '../../storage/gcs';
import { SessionModel } from './model';
import { SessionService } from './service';

export function createSessionModule(service: SessionService) {
  return new Elysia({
    prefix: '/sessions',
    name: 'sessions',
  })
    .onError(({ code, error, status }) => {
      if (code === 'VALIDATION') return;
      console.error('Unexpected error creating draft session:', error);
      return status(500, SessionModel.draftCreationFailed.const);
    })
    .post('/analyze', ({ body }) => service.createDraftFromImage(body), {
      body: SessionModel.analyzeBody,
      response: {
        200: SessionModel.draftSessionResponse,
        500: SessionModel.draftCreationFailed,
        502: SessionModel.analysisFailed,
      },
      detail: {
        summary: 'Analyze a receipt photo and create a draft session',
        tags: ['Sessions'],
      },
    });
}

export const sessionModule = createSessionModule(
  new SessionService(extractReceipt, gcsReceiptStorage),
);
