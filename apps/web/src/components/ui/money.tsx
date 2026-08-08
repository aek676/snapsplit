import { NumericFormat } from 'react-number-format';

import { currencySymbol } from '@/utils/money';

interface MoneyProps {
  cents: number;
  currency: string;
  className?: string;
}

export function Money({ cents, currency, className }: MoneyProps) {
  return (
    <NumericFormat
      displayType="text"
      value={cents / 100}
      prefix={currencySymbol(currency)}
      thousandSeparator
      decimalScale={2}
      fixedDecimalScale
      className={className}
    />
  );
}
