import { useSetClaim } from '@/features/session/claim/api/set-claim';
import { ClaimStepper } from '@/features/session/claim/components/claim-stepper';
import { ClaimantAvatars } from '@/features/session/claim/components/claimant-avatars';
import { LineItemRowShell } from '@/features/session/components/line-item-row-shell';
import { myUnits, remainingUnits } from '@/features/session/utils/claim-totals';
import type { LineItem, Session } from '@/types/session';

type ClaimLineItemRowProps = {
  session: Session;
  lineItem: LineItem;
  participantId: string | null;
  disabled?: boolean;
};

export function ClaimLineItemRow({
  session,
  lineItem,
  participantId,
  disabled,
}: ClaimLineItemRowProps) {
  const setClaim = useSetClaim({ sessionId: session.id });
  const units = myUnits(lineItem, participantId);
  const remaining = remainingUnits(lineItem);

  return (
    <LineItemRowShell
      lineItem={lineItem}
      currency={session.currency}
      flag={remaining > 0 ? 'Unassigned' : undefined}
      footer={
        lineItem.claims.length > 0 && (
          <ClaimantAvatars
            claims={lineItem.claims}
            participants={session.participants}
            participantId={participantId}
          />
        )
      }
    >
      <ClaimStepper
        itemName={lineItem.name}
        units={units}
        canIncrement={remaining > 0}
        disabled={disabled || !participantId}
        onChange={(next) =>
          setClaim.mutate({
            sessionId: session.id,
            lineItemId: lineItem.id,
            units: next,
          })
        }
      />
    </LineItemRowShell>
  );
}
