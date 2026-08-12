import { LOW_CONFIDENCE_THRESHOLD } from '@repo/shared-types';
import { Link as LinkIcon } from 'lucide-react';
import { Button } from 'shadcn-ui/button';
import { useConfirmSession } from '@/features/session/api/confirm-session';
import { receiptTotals } from '@/features/session/utils/receipt-totals';
import type { Session } from '@/types/session';

interface ConfirmSessionButtonProps {
  session: Session;
}

export function ConfirmSessionButton({ session }: ConfirmSessionButtonProps) {
  const totals = receiptTotals(session);
  const hasItems = session.lineItems.length > 0;
  const hasLowConfidence = session.lineItems.some(
    (item) => item.aiConfidence < LOW_CONFIDENCE_THRESHOLD,
  );

  const canConfirm = totals.matches && hasItems && !hasLowConfidence;
  const confirmSession = useConfirmSession({ sessionId: session.id });

  return (
    <Button
      size="xl"
      className="flex-1"
      disabled={!canConfirm || confirmSession.isPending}
      onClick={() => confirmSession.mutate({ sessionId: session.id })}
    >
      Confirm & create link
      <LinkIcon size={20} />
    </Button>
  );
}
