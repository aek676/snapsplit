import { Pencil } from 'lucide-react';
import { Button } from 'shadcn-ui/button';
import { Money } from '@/components/ui/money';
import { DeleteLineItem } from '@/features/session/line-item/components/delete-line-item';
import type { LineItem } from '@/types/session';

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

interface LineItemRowProps {
  sessionId: string;
  lineItem: LineItem;
  currency: string;
  onEdit: () => void;
}

export function LineItemRow({
  sessionId,
  lineItem,
  currency,
  onEdit,
}: LineItemRowProps) {
  const lowConfidence = lineItem.aiConfidence < LOW_CONFIDENCE_THRESHOLD;

  return (
    <li
      className={`relative flex flex-col gap-2 border-b border-border px-4 py-5 sm:flex-row sm:items-center sm:gap-4 ${
        lowConfidence ? 'border-l-[3px] border-l-warning' : ''
      }`}
    >
      {lowConfidence && (
        <span className="absolute top-2 left-4 eyebrow text-warning">
          Check this
        </span>
      )}
      <span className={`item-name sm:flex-1 ${lowConfidence ? 'mt-3' : ''}`}>
        {lineItem.name}
      </span>
      <div className="flex items-center gap-3 sm:contents">
        <Money
          cents={lineItem.unitPriceCents}
          currency={currency}
          className="unit-meta text-content-secondary"
        />
        <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[13px] font-bold text-content-secondary tabular-nums">
          x{lineItem.quantity}
        </span>
        <Money
          cents={lineItem.lineTotalCents}
          currency={currency}
          className="ml-auto w-20 text-right price-total sm:ml-0"
        />
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={`Edit ${lineItem.name}`}
          onClick={onEdit}
        >
          <Pencil />
        </Button>
        <DeleteLineItem sessionId={sessionId} lineItem={lineItem} />
      </div>
    </li>
  );
}
