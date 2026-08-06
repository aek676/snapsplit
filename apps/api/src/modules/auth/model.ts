import { t } from 'elysia';

export const AuthModel = {
  unauthorized: t.Literal('Unauthorized'),
  forbidden: t.Literal('Forbidden'),
} as const;

export type AuthModel = {
  [K in keyof typeof AuthModel]: (typeof AuthModel)[K]['static'];
};
