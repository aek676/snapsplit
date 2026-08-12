export function isDuplicateKeyError(error: unknown, key: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, keyPattern } = error as {
    code?: number;
    keyPattern?: Record<string, unknown>;
  };
  return code === 11000 && keyPattern?.[key] !== undefined;
}
