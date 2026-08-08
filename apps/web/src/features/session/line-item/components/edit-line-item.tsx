import { Pencil } from 'lucide-react';
import { useState } from 'react';

import { Button } from 'shadcn-ui/button';
import { EditLineItemModal } from '@/features/session/line-item/components/edit-line-item-modal';
import type { LineItem } from '@/types/session';

interface EditLineItemProps {
  sessionId: string;
  lineItem: LineItem;
  currency: string;
}

export function EditLineItem({
  sessionId,
  lineItem,
  currency,
}: EditLineItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label={`Edit ${lineItem.name}`}
        onClick={() => setOpen(true)}
      >
        <Pencil />
      </Button>
      {open && (
        <EditLineItemModal
          sessionId={sessionId}
          initial={lineItem}
          currency={currency}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
