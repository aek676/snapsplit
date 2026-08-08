import { Plus } from 'lucide-react';
import { useState } from 'react';

import { AddLineItemModal } from '@/features/session/line-item/components/add-line-item-modal';
import { EditLineItemModal } from '@/features/session/line-item/components/edit-line-item-modal';
import { LineItemRow } from '@/features/session/line-item/components/line-item-row';
import type { LineItem, Session } from '@/types/session';

type EditorState = { mode: 'add' } | { mode: 'edit'; lineItem: LineItem };

interface LineItemListProps {
  session: Session;
}

export function LineItemList({ session }: LineItemListProps) {
  const sessionId = session.id;
  const [editor, setEditor] = useState<EditorState | null>(null);

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
              onEdit={() => setEditor({ mode: 'edit', lineItem })}
            />
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setEditor({ mode: 'add' })}
          className="flex w-full items-center gap-2 px-4 py-5 text-primary transition-colors hover:bg-primary-tint/50 active:bg-primary-tint"
        >
          <Plus size={20} />
          <span className="item-name">Add item by hand</span>
        </button>
      </div>

      {editor?.mode === 'add' && (
        <AddLineItemModal
          sessionId={sessionId}
          currency={session.currency}
          onSaved={() => setEditor(null)}
          onCancel={() => setEditor(null)}
        />
      )}
      {editor?.mode === 'edit' && (
        <EditLineItemModal
          sessionId={sessionId}
          initial={editor.lineItem}
          currency={session.currency}
          onSaved={() => setEditor(null)}
          onCancel={() => setEditor(null)}
        />
      )}
    </>
  );
}
