import { describe, expect, it } from 'bun:test';
import {
  isSessionCode,
  SESSION_CODE_ALPHABET,
  SESSION_CODE_PATTERN,
} from './session-code';

describe('isSessionCode', () => {
  it.each([
    ['a share code', 'ABCDEFGH'],
    ['digits from the alphabet', '23456789'],
    ['a lowercase code, since the API upper-cases it', 'abcdefgh'],
    ['a mixed-case code', 'AbCdEfGh'],
  ])('accepts %s', (_label, value) => {
    expect(isSessionCode(value)).toBe(true);
  });

  it.each([
    ['the look-alike letters O, I and L', 'ABCDEFOI'],
    ['the look-alike digits 0 and 1', 'ABCDEF01'],
    ['punctuation', 'ABCDEF-H'],
    ['too few characters', 'ABCDEFG'],
    ['too many characters', 'ABCDEFGHI'],
    ['an empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(isSessionCode(value)).toBe(false);
  });

  it('accepts every character the generator can emit', () => {
    for (const char of SESSION_CODE_ALPHABET) {
      expect(isSessionCode(char.repeat(8))).toBe(true);
    }
  });

  it('is anchored, so it does not match a code embedded in a longer string', () => {
    expect(isSessionCode('/s/ABCDEFGH')).toBe(false);
    expect(SESSION_CODE_PATTERN.startsWith('^')).toBe(true);
    expect(SESSION_CODE_PATTERN.endsWith('$')).toBe(true);
  });
});
