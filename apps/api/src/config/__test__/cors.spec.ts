import { describe, expect, it } from 'bun:test';
import { parseCorsOrigin } from '../cors';

describe('parseCorsOrigin', () => {
  it.each([
    ['unset', undefined],
    ['an empty string', ''],
    ['only whitespace', '  '],
    ['only commas', ',,'],
  ])('allows any origin when %s', (_label, raw) => {
    expect(parseCorsOrigin(raw)).toBe(true);
  });

  it('parses a single origin', () => {
    expect(parseCorsOrigin('https://app.example.com')).toEqual([
      'https://app.example.com',
    ]);
  });

  it('parses a comma-separated list, trimming padding', () => {
    expect(
      parseCorsOrigin(
        ' https://app.example.com , https://staging.example.com ',
      ),
    ).toEqual(['https://app.example.com', 'https://staging.example.com']);
  });

  it('drops empty segments', () => {
    expect(parseCorsOrigin('https://app.example.com,,')).toEqual([
      'https://app.example.com',
    ]);
  });

  it.each([
    ['unset', undefined],
    ['an empty string', ''],
    ['only whitespace', '  '],
    ['only commas', ',,'],
  ])('throws in production when %s', (_label, raw) => {
    expect(() => parseCorsOrigin(raw, 'production')).toThrow(
      'CORS_ORIGIN must be set in production',
    );
  });

  it('returns the configured origins in production', () => {
    expect(parseCorsOrigin('https://app.example.com', 'production')).toEqual([
      'https://app.example.com',
    ]);
  });

  it('allows any origin outside production', () => {
    expect(parseCorsOrigin(undefined, 'development')).toBe(true);
  });
});
