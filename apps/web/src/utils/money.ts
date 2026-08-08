export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export interface CurrencyFormat {
  symbol: string;
  prefix: string;
  suffix: string;
  thousandSeparator: string;
  decimalSeparator: string;
  decimalScale: number;
}

const SAMPLE = 1234567.89;

const cache = new Map<string, CurrencyFormat>();

export function currencyFormat(
  currency: string,
  locale?: string,
): CurrencyFormat {
  const key = `${locale ?? ''}|${currency}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  });
  const parts = formatter.formatToParts(SAMPLE);

  const symbolIndex = parts.findIndex((part) => part.type === 'currency');
  const amountIndex = parts.findIndex((part) => part.type === 'integer');
  const symbolLeads = symbolIndex !== -1 && symbolIndex < amountIndex;
  const symbol = parts[symbolIndex]?.value ?? currency;

  const adjacent = parts[symbolLeads ? symbolIndex + 1 : symbolIndex - 1];
  const gap = adjacent?.type === 'literal' ? adjacent.value : '';

  const format: CurrencyFormat = {
    symbol,
    prefix: symbolLeads ? `${symbol}${gap}` : '',
    suffix: symbolLeads ? '' : `${gap}${symbol}`,
    thousandSeparator: parts.find((part) => part.type === 'group')?.value ?? '',
    decimalSeparator:
      parts.find((part) => part.type === 'decimal')?.value ?? '.',
    decimalScale: formatter.resolvedOptions().maximumFractionDigits ?? 2,
  };

  cache.set(key, format);
  return format;
}

export function currencySymbol(currency: string): string {
  return currencyFormat(currency).symbol;
}
