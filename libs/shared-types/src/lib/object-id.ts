export const OBJECT_ID_PATTERN = '^[a-f\\d]{24}$';

const OBJECT_ID = new RegExp(OBJECT_ID_PATTERN);

export function isObjectId(value: string): boolean {
  return OBJECT_ID.test(value);
}
