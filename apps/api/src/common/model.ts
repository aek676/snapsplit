import { OBJECT_ID_PATTERN } from '@repo/shared-types';
import { t } from 'elysia';

export const objectId = t.String({ pattern: OBJECT_ID_PATTERN });
