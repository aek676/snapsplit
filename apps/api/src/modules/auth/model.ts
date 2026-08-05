import { t } from 'elysia';
import { OBJECT_ID_PATTERN } from '../../constants';

export const objectId = t.String({
  pattern: OBJECT_ID_PATTERN,
  error: 'Invalid id',
});

export const AuthModel = {
  unauthorized: t.Literal('Unauthorized'),
  forbidden: t.Literal('Forbidden'),
} as const;

export type AuthModel = {
  [K in keyof typeof AuthModel]: (typeof AuthModel)[K]['static'];
};
