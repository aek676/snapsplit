import { NumericFormat } from 'react-number-format';

import { currencySymbol } from '@/utils/money';

interface MoneyProps {
  cents: number;
  currency: string;
  suffix?: string;
  className?: string;
}

export function Money({ cents, currency, suffix, className }: MoneyProps) {
  return (
    <NumericFormat
      displayType="text"
      value={cents / 100}
      prefix={currencySymbol(currency)}
      suffix={suffix}
      thousandSeparator
      decimalScale={2}
      fixedDecimalScale
      className={className}
    />
  );
}
