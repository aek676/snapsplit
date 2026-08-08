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
      className={`relative flex items-center gap-4 border-b border-border px-4 py-5 ${
        lowConfidence ? 'border-l-[3px] border-l-warning' : ''
      }`}
    >
      {lowConfidence && (
        <span className="absolute top-2 left-4 eyebrow text-warning">
          Check this
        </span>
      )}
      <span className={`flex-1 item-name ${lowConfidence ? 'mt-3' : ''}`}>
        {lineItem.name}
      </span>
      <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[13px] font-bold text-content-secondary tabular-nums">
        x{lineItem.quantity}
      </span>
      <Money
        cents={lineItem.lineTotalCents}
        currency={currency}
        className="w-20 text-right price-total"
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
    </li>
  );
}
