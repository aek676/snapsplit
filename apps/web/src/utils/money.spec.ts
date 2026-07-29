import { describe, expect, it } from 'vitest';
import { currencySymbol, formatCents } from '@/utils/money';

describe('formatCents', () => {
  it('formats cents as a currency amount', () => {
    expect(formatCents(4230, 'EUR')).toMatch(/42[.,]30/);
    expect(formatCents(0, 'EUR')).toMatch(/0[.,]00/);
  });
});

describe('currencySymbol', () => {
  it('returns the narrow symbol for a currency', () => {
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('USD')).toBe('$');
  });
});
