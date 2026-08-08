import { Money } from '@/components/ui/money';
import { DeleteLineItem } from '@/features/session/line-item/components/delete-line-item';
import { EditLineItem } from '@/features/session/line-item/components/edit-line-item';
import type { LineItem } from '@/types/session';

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

interface LineItemRowProps {
  sessionId: string;
  lineItem: LineItem;
  currency: string;
}

export function LineItemRow({
  sessionId,
  lineItem,
  currency,
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
      <div className={`min-w-0 flex-1 ${lowConfidence ? 'mt-3' : ''}`}>
        <div className="flex items-center gap-2">
          <span className="item-name">{lineItem.name}</span>
          <span className="label-nav shrink-0 rounded-full bg-surface-alt px-2 py-0.5 text-content-secondary tabular-nums">
            x{lineItem.quantity}
          </span>
        </div>
        <Money
          cents={lineItem.unitPriceCents}
          currency={currency}
          suffix="/unit"
          className="mt-2 block unit-meta text-content-secondary"
        />
      </div>
      <Money
        cents={lineItem.lineTotalCents}
        currency={currency}
        className="shrink-0 text-right price-total"
      />
      <EditLineItem
        sessionId={sessionId}
        lineItem={lineItem}
        currency={currency}
      />
      <DeleteLineItem sessionId={sessionId} lineItem={lineItem} />
    </li>
  );
}
