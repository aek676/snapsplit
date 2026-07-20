import { Elysia, t } from 'elysia';
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
      console.error('Unexpected error in sessions module:', error);
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
    })
    .post(
      '/:sessionId/line-items',
      ({ params, body }) => service.addLineItem(params.sessionId, body),
      {
        params: SessionModel.sessionParams,
        body: SessionModel.lineItemCreateBody,
        response: {
          200: SessionModel.draftSessionResponse,
          404: SessionModel.sessionNotFound,
          409: SessionModel.sessionNotDraft,
          500: SessionModel.draftCreationFailed,
        },
        detail: {
          summary: 'Add a line item to a draft session',
          tags: ['Sessions'],
        },
      },
    )
    .patch(
      '/:sessionId/line-items/:lineItemId',
      ({ params, body }) =>
        service.updateLineItem(params.sessionId, params.lineItemId, body),
      {
        params: SessionModel.lineItemParams,
        body: SessionModel.lineItemUpdateBody,
        response: {
          200: SessionModel.draftSessionResponse,
          404: t.Union([
            SessionModel.sessionNotFound,
            SessionModel.lineItemNotFound,
          ]),
          409: SessionModel.sessionNotDraft,
          500: SessionModel.draftCreationFailed,
        },
        detail: {
          summary: 'Edit a line item on a draft session',
          tags: ['Sessions'],
        },
      },
    );
}

export const sessionModule = createSessionModule(
  new SessionService(extractReceipt, gcsReceiptStorage),
);
