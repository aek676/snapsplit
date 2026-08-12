import { describe, expect, it } from 'vitest';
import {
  currencyFormat,
  currencySymbol,
  formatCents,
  formatCentsBare,
} from '@/utils/money';

/** Locale separators are routinely not ASCII whitespace. */
const NBSP = ' ';
const NARROW_NBSP = ' ';

describe('formatCents', () => {
  it('formats cents as a currency amount', () => {
    expect(formatCents(4230, 'EUR')).toMatch(/42[.,]30/);
    expect(formatCents(0, 'EUR')).toMatch(/0[.,]00/);
  });
});

describe('formatCentsBare', () => {
  it('formats the amount without a currency symbol', () => {
    expect(formatCentsBare(4230, 'EUR')).toMatch(/^42[.,]30$/);
    expect(formatCentsBare(0, 'EUR')).toMatch(/^0[.,]00$/);
  });

  it('takes the fraction digits from the currency', () => {
    expect(formatCentsBare(4230, 'JPY')).toBe('42');
  });
});

describe('currencySymbol', () => {
  it('returns the narrow symbol for a currency', () => {
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('USD')).toBe('$');
  });
});

describe('currencyFormat', () => {
  it('puts the symbol in front for locales that lead with it', () => {
    const format = currencyFormat('USD', 'en-US');

    expect(format.prefix).toBe('$');
    expect(format.suffix).toBe('');
    expect(format.thousandSeparator).toBe(',');
    expect(format.decimalSeparator).toBe('.');
  });

  it('puts the symbol after the amount for locales that trail it', () => {
    const format = currencyFormat('EUR', 'es-ES');

    expect(format.prefix).toBe('');
    expect(format.suffix).toBe(`${NBSP}€`);
    expect(format.thousandSeparator).toBe('.');
    expect(format.decimalSeparator).toBe(',');
  });

  it('keeps the locale spacing verbatim rather than normalising it', () => {
    expect(currencyFormat('EUR', 'fr-FR').thousandSeparator).toBe(NARROW_NBSP);
  });

  it('never returns equal separators, which NumericFormat throws on', () => {
    for (const locale of ['en-US', 'de-DE', 'es-ES', 'fr-FR', 'en-CH']) {
      for (const currency of ['EUR', 'USD', 'CHF']) {
        const format = currencyFormat(currency, locale);
        expect(format.thousandSeparator).not.toBe(format.decimalSeparator);
      }
    }
  });

  it('takes the fraction digits from the currency, not a fixed 2', () => {
    expect(currencyFormat('EUR', 'en-US').decimalScale).toBe(2);
    expect(currencyFormat('JPY', 'en-US').decimalScale).toBe(0);
  });
});
