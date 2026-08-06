import { describe, expect, it } from 'bun:test';
import { isObjectId, OBJECT_ID_PATTERN } from './object-id';

describe('isObjectId', () => {
  it.each([
    ['a session id', '507f1f77bcf86cd799439011'],
    ['another session id', '507f191e810c19729de860ea'],
    ['all digits', '000000000000000000000000'],
    ['all hex letters', 'abcdefabcdefabcdefabcdef'],
  ])('accepts %s', (_label, value) => {
    expect(isObjectId(value)).toBe(true);
  });

  it.each([
    ['a slug', 'session-a'],
    ['non-hex characters', 'zzzzzzzzzzzzzzzzzzzzzzzz'],
    ['uppercase hex', '507F1F77BCF86CD799439011'],
    ['too few characters', '507f1f77bcf86cd79943901'],
    ['too many characters', '507f1f77bcf86cd7994390111'],
    ['an empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(isObjectId(value)).toBe(false);
  });

  it('is anchored, so it does not match an id embedded in a longer string', () => {
    expect(isObjectId('/sessions/507f1f77bcf86cd799439011')).toBe(false);
    expect(OBJECT_ID_PATTERN.startsWith('^')).toBe(true);
    expect(OBJECT_ID_PATTERN.endsWith('$')).toBe(true);
  });
});
