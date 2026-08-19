import { cn } from 'shadcn-ui-utils';
import { Money } from '@/components/ui/money';
import type { LineItem } from '@/types/session';

type LineItemRowShellProps = {
  lineItem: Pick<LineItem, 'name' | 'unitPriceCents'>;
  currency: string;
  flag?: string;
  muted?: boolean;
  children?: React.ReactNode;
  footer?: React.ReactNode;
};

export function LineItemRowShell({
  lineItem,
  currency,
  flag,
  muted,
  children,
  footer,
}: LineItemRowShellProps) {
  return (
    <li
      className={cn(
        'relative border-b border-border px-4 pb-5',
        flag ? 'border-l-[3px] border-l-warning pt-8' : 'pt-5',
        muted && 'bg-surface-muted',
      )}
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
        {children}
      </div>
      {footer}
    </li>
  );
}
