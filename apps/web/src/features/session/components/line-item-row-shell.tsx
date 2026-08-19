import { Badge } from 'shadcn-ui/badge';
import { Money } from '@/components/ui/money';
import type { LineItem } from '@/types/session';

type LineItemRowShellProps = {
  lineItem: Pick<LineItem, 'name' | 'quantity' | 'unitPriceCents'>;
  currency: string;
  flag?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
};

export function LineItemRowShell({
  lineItem,
  currency,
  flag,
  children,
  footer,
}: LineItemRowShellProps) {
  return (
    <li
      className={`relative border-b border-border px-4 pb-5 ${
        flag ? 'border-l-[3px] border-l-warning pt-8' : 'pt-5'
      }`}
    >
      {flag && (
        <span className="absolute top-2 left-4 eyebrow text-warning">
          {flag}
        </span>
      )}
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="item-name wrap-anywhere">{lineItem.name}</span>
          <Money
            cents={lineItem.unitPriceCents}
            currency={currency}
            suffix="/unit"
            className="unit-meta text-content-secondary"
          />
        </div>
        <Badge variant="neutral">x{lineItem.quantity}</Badge>
        {children}
      </div>
      {footer}
    </li>
  );
}
