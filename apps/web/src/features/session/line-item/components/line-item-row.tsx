import { LOW_CONFIDENCE_THRESHOLD } from '@repo/shared-types';
import { Money } from '@/components/ui/money';
import { DeleteLineItem } from '@/features/session/line-item/components/delete-line-item';
import { EditLineItem } from '@/features/session/line-item/components/edit-line-item';
import type { LineItem } from '@/types/session';

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
      className={`relative flex items-center gap-2 border-b border-border px-4 pb-5 ${
        lowConfidence ? 'border-l-[3px] border-l-warning pt-8' : 'pt-5'
      }`}
    >
      {lowConfidence && (
        <span className="absolute top-2 left-4 eyebrow text-warning">
          Check this
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="item-name wrap-anywhere">{lineItem.name}</span>
        <Money
          cents={lineItem.unitPriceCents}
          currency={currency}
          suffix="/unit"
          className="unit-meta text-content-secondary"
        />
      </div>
      <span className="label-nav min-w-9 shrink-0 rounded-full bg-surface-alt px-2 py-0.5 text-center text-content-secondary tabular-nums">
        x{lineItem.quantity}
      </span>
      <Money
        cents={lineItem.lineTotalCents}
        currency={currency}
        className="w-16 shrink-0 text-right price-total"
      />
      <div className="flex sm:gap-4">
        <EditLineItem
          sessionId={sessionId}
          lineItem={lineItem}
          currency={currency}
        />
        <DeleteLineItem sessionId={sessionId} lineItem={lineItem} />
      </div>
    </li>
  );
}
