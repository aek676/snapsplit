import { AddLineItem } from '@/features/session/line-item/components/add-line-item';
import { LineItemRow } from '@/features/session/line-item/components/line-item-row';
import type { Session } from '@/types/session';

interface LineItemListProps {
  session: Session;
}

export function LineItemList({ session }: LineItemListProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-[0_4px_16px_rgba(42,37,48,0.04)]">
      <ul>
        {session.lineItems.map((lineItem) => (
          <LineItemRow
            key={lineItem.id}
            sessionId={session.id}
            lineItem={lineItem}
            currency={session.currency}
          />
        ))}
      </ul>
      <AddLineItem sessionId={session.id} currency={session.currency} />
    </div>
  );
}
