import { NumericFormat } from 'react-number-format';

import { currencyFormat } from '@/utils/money';

interface CurrencyInputProps {
  id?: string;
  currency: string;
  value: number;
  onChange: (cents: number) => void;
}

export function CurrencyInput({
  id,
  currency,
  value,
  onChange,
}: CurrencyInputProps) {
  const format = currencyFormat(currency);

  return (
    <div className="flex items-center rounded-xl bg-surface-alt px-4 py-3">
      <span className="mr-1 item-name text-content-secondary">
        {format.symbol}
      </span>
      <NumericFormat
        id={id}
        value={value / 100}
        thousandSeparator={format.thousandSeparator}
        decimalSeparator={format.decimalSeparator}
        decimalScale={format.decimalScale}
        allowNegative={false}
        onValueChange={(values) => {
          onChange(Math.round((values.floatValue ?? 0) * 100));
        }}
        className="w-full border-none bg-transparent p-0 item-name text-content-primary tabular-nums focus:ring-0 focus:outline-none"
      />
    </div>
  );
}
