export function isDuplicateKeyError(error: unknown, key?: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, keyPattern } = error as {
    code?: number;
    keyPattern?: Record<string, unknown>;
  };
  if (code !== 11000) return false;
  return key === undefined || keyPattern === undefined || key in keyPattern;
}