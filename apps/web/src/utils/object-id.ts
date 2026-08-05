import { OBJECT_ID_PATTERN } from '@repo/api/constants';

const OBJECT_ID = new RegExp(OBJECT_ID_PATTERN);

export function isObjectId(value: string): boolean {
  return OBJECT_ID.test(value);
}
