import { OBJECT_ID_PATTERN, SESSION_CODE_PATTERN } from '@repo/shared-types';
import { t } from 'elysia';

export const objectId = t.String({ pattern: OBJECT_ID_PATTERN });

export const sessionCode = t.String({ pattern: SESSION_CODE_PATTERN });
