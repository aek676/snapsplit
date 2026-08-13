/** Excludes the characters that read alike: 0/O and 1/I. */
export const SESSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const SESSION_CODE_LENGTH = 8;

export const SESSION_CODE_PATTERN = `^[${SESSION_CODE_ALPHABET}${SESSION_CODE_ALPHABET.toLowerCase()}]{${SESSION_CODE_LENGTH}}$`;

const SESSION_CODE = new RegExp(SESSION_CODE_PATTERN);

export function isSessionCode(value: string): boolean {
  return SESSION_CODE.test(value);
}
