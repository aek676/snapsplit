import { NumericFormat } from 'react-number-format';

import { currencyFormat } from '@/utils/money';

type MoneyProps = {
  cents: number;
  currency: string;
  /** Appended after the amount, e.g. "/unit". */
  suffix?: string;
  className?: string;
};

export function Money({ cents, currency, suffix, className }: MoneyProps) {
  const format = currencyFormat(currency);

  return (
    <NumericFormat
      displayType="text"
      value={cents / 100}
      prefix={format.prefix}
      suffix={`${format.suffix}${suffix ?? ''}`}
      thousandSeparator={format.thousandSeparator}
      decimalSeparator={format.decimalSeparator}
      decimalScale={format.decimalScale}
      fixedDecimalScale
      className={className}
    />
  );
}
