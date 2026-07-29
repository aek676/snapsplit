import { NumericFormat } from 'react-number-format';

import { currencySymbol } from '@/utils/money';

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
  return (
    <div className="flex items-center rounded-xl bg-surface-alt px-4 py-3">
      <span className="mr-1 item-name text-content-secondary">
        {currencySymbol(currency)}
      </span>
      <NumericFormat
        id={id}
        value={value / 100}
        decimalScale={2}
        allowNegative={false}
        onValueChange={(values) => {
          onChange(Math.round((values.floatValue ?? 0) * 100));
        }}
        className="w-full border-none bg-transparent p-0 item-name text-content-primary tabular-nums focus:ring-0 focus:outline-none"
      />
    </div>
  );
}
