import { LOW_CONFIDENCE_THRESHOLD } from '@repo/shared-types';
import { Badge } from 'shadcn-ui/badge';
import { Money } from '@/components/ui/money';
import { LineItemRowShell } from '@/features/session/components/line-item-row-shell';
import { DeleteLineItem } from '@/features/session/line-item/components/delete-line-item';
import { EditLineItem } from '@/features/session/line-item/components/edit-line-item';
import type { LineItem } from '@/types/session';

type LineItemRowProps = {
  sessionId: string;
  lineItem: LineItem;
  currency: string;
};

export function LineItemRow({
  sessionId,
  lineItem,
  currency,
}: LineItemRowProps) {
  const lowConfidence = lineItem.aiConfidence < LOW_CONFIDENCE_THRESHOLD;

  return (
    <LineItemRowShell
      lineItem={lineItem}
      currency={currency}
      flag={lowConfidence ? 'Check this' : undefined}
    >
      <Badge variant="neutral">x{lineItem.quantity}</Badge>
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
    </LineItemRowShell>
  );
}
