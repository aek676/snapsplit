import { Plus } from 'lucide-react';
import { useState } from 'react';

import { AddLineItemModal } from '@/features/session/line-item/components/add-line-item-modal';
import { LineItemRow } from '@/features/session/line-item/components/line-item-row';
import type { Session } from '@/types/session';

interface LineItemListProps {
  session: Session;
}

export function LineItemList({ session }: LineItemListProps) {
  const sessionId = session.id;
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-[0_4px_16px_rgba(42,37,48,0.04)]">
        <ul>
          {session.lineItems.map((lineItem) => (
            <LineItemRow
              key={lineItem.id}
              sessionId={sessionId}
              lineItem={lineItem}
              currency={session.currency}
            />
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center gap-2 px-4 py-5 text-primary transition-colors hover:bg-primary-tint/50 active:bg-primary-tint"
        >
          <Plus size={20} />
          <span className="item-name">Add item by hand</span>
        </button>
      </div>

      {adding && (
        <AddLineItemModal
          sessionId={sessionId}
          currency={session.currency}
          onSaved={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      )}
    </>
  );
}
