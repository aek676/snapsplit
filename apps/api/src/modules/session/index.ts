import { Elysia, t } from 'elysia';
import { extractReceipt } from '../../ai/receipt';
import { authPlugin } from '../../plugins/auth';
import { receiptStorage } from '../../storage';
import { AuthModel } from '../auth/model';
import { SessionModel } from './model';
import { SessionService, toSessionView } from './service';

export function createSessionModule(service: SessionService) {
  return new Elysia({
    prefix: '/sessions',
    name: 'sessions',
  })
    .use(authPlugin)
    .onError(({ code, error, status }) => {
      if (code === 'VALIDATION') return;
      console.error('Unexpected error in sessions module:', error);
      return status(500, SessionModel.internalError.const);
    })
    .post('/analyze', ({ body }) => service.createDraftFromImage(body), {
      body: SessionModel.analyzeBody,
      response: {
        200: SessionModel.draftSessionCreatedResponse,
        500: t.Union([
          SessionModel.draftCreationFailed,
          SessionModel.internalError,
        ]),
        502: SessionModel.analysisFailed,
      },
      detail: {
        summary: 'Analyze a receipt photo and create a draft session',
        tags: ['Sessions'],
      },
    })
    .get('/:sessionId', ({ session }) => toSessionView(session), {
      auth: true,
      params: SessionModel.sessionParams,
      response: {
        200: SessionModel.draftSessionResponse,
        401: AuthModel.unauthorized,
        403: AuthModel.forbidden,
        500: SessionModel.internalError,
      },
      detail: {
        summary: 'Get a session by id',
        tags: ['Sessions'],
      },
    })
    .patch(
      '/:sessionId',
      ({ session, body }) => service.updateSession(session, body),
      {
        owner: true,
        params: SessionModel.sessionParams,
        body: SessionModel.sessionUpdateBody,
        response: {
          200: SessionModel.draftSessionResponse,
          401: AuthModel.unauthorized,
          403: AuthModel.forbidden,
          409: t.Union([
            SessionModel.sessionNotDraft,
            SessionModel.totalPatchConflict,
          ]),
          500: SessionModel.internalError,
        },
        detail: {
          summary: 'Edit the receipt details of a draft session',
          tags: ['Sessions'],
        },
      },
    )
    .delete('/:sessionId', ({ session }) => service.deleteSession(session), {
      owner: true,
      params: SessionModel.sessionParams,
      response: {
        204: SessionModel.noContent,
        401: AuthModel.unauthorized,
        403: AuthModel.forbidden,
        500: SessionModel.internalError,
      },
      detail: {
        summary: 'Delete a session and its receipt image',
        tags: ['Sessions'],
      },
    })
    .post(
      '/:sessionId/line-items',
      ({ session, body }) => service.addLineItem(session, body),
      {
        owner: true,
        params: SessionModel.sessionParams,
        body: SessionModel.lineItemCreateBody,
        response: {
          200: SessionModel.draftSessionResponse,
          401: AuthModel.unauthorized,
          403: AuthModel.forbidden,
          409: SessionModel.sessionNotDraft,
          500: SessionModel.internalError,
        },
        detail: {
          summary: 'Add a line item to a draft session',
          tags: ['Sessions'],
        },
      },
    )
    .patch(
      '/:sessionId/line-items/:lineItemId',
      ({ session, params, body }) =>
        service.updateLineItem(session, params.lineItemId, body),
      {
        owner: true,
        params: SessionModel.lineItemParams,
        body: SessionModel.lineItemUpdateBody,
        response: {
          200: SessionModel.draftSessionResponse,
          401: AuthModel.unauthorized,
          403: AuthModel.forbidden,
          404: SessionModel.lineItemNotFound,
          409: SessionModel.sessionNotDraft,
          500: SessionModel.internalError,
        },
        detail: {
          summary: 'Edit a line item on a draft session',
          tags: ['Sessions'],
        },
      },
    )
    .delete(
      '/:sessionId/line-items/:lineItemId',
      ({ session, params }) =>
        service.deleteLineItem(session, params.lineItemId),
      {
        owner: true,
        params: SessionModel.lineItemParams,
        response: {
          200: SessionModel.draftSessionResponse,
          401: AuthModel.unauthorized,
          403: AuthModel.forbidden,
          404: SessionModel.lineItemNotFound,
          409: SessionModel.sessionNotDraft,
          500: SessionModel.internalError,
        },
        detail: {
          summary: 'Delete a line item from a draft session',
          tags: ['Sessions'],
        },
      },
    )
    .post(
      '/:sessionId/confirm',
      ({ session }) => service.confirmSession(session),
      {
        owner: true,
        params: SessionModel.sessionParams,
        response: {
          200: SessionModel.draftSessionResponse,
          401: AuthModel.unauthorized,
          403: AuthModel.forbidden,
          409: t.Union([
            SessionModel.sessionNotDraft,
            SessionModel.sessionEmpty,
            SessionModel.sessionNeedsReview,
            SessionModel.sessionTotalMismatch,
          ]),
          500: t.Union([
            SessionModel.codeGenerationFailed,
            SessionModel.internalError,
          ]),
        },
        detail: {
          summary: 'Confirm a draft session and publish its share code',
          tags: ['Sessions'],
        },
      },
    )
    .post(
      '/join/:code',
      ({ params, body, headers }) => {
        const bearer = headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        return service.joinSession(params.code, body.name, bearer);
      },
      {
        params: SessionModel.joinParams,
        body: SessionModel.joinBody,
        response: {
          200: SessionModel.joinResponse,
          404: SessionModel.sessionNotFound,
          409: SessionModel.sessionNotOpen,
          500: SessionModel.internalError,
        },
        detail: {
          summary: 'Join a session by share code',
          tags: ['Sessions'],
        },
      },
    );
}

export const sessionModule = createSessionModule(
  new SessionService(extractReceipt, receiptStorage),
);
