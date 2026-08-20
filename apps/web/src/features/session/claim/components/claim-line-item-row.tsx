import { memo } from 'react';

import { useSetClaim } from '@/features/session/claim/api/set-claim';
import { ClaimStepper } from '@/features/session/claim/components/claim-stepper';
import { ClaimantAvatars } from '@/features/session/claim/components/claimant-avatars';
import { LineItemRowShell } from '@/features/session/components/line-item-row-shell';
import { myUnits, remainingUnits } from '@/features/session/utils/claim-totals';
import type { LineItem, Session } from '@/types/session';

type ClaimLineItemRowProps = {
  sessionId: string;
  currency: string;
  participants: Session['participants'];
  lineItem: LineItem;
  participantId: string | null;
  disabled?: boolean;
};

function ClaimLineItemRowImpl({
  sessionId,
  currency,
  participants,
  lineItem,
  participantId,
  disabled,
}: ClaimLineItemRowProps) {
  const setClaim = useSetClaim({ sessionId });
  const units = myUnits(lineItem, participantId);
  const remaining = remainingUnits(lineItem);

  return (
    <LineItemRowShell
      lineItem={lineItem}
      currency={currency}
      muted={remaining === 0}
      footer={
        lineItem.claims.length > 0 && (
          <ClaimantAvatars
            claims={lineItem.claims}
            participants={participants}
            participantId={participantId}
          />
        )
      }
    >
      <ClaimStepper
        itemName={lineItem.name}
        units={units}
        remaining={remaining}
        disabled={disabled || !participantId}
        onChange={(next) =>
          setClaim.mutate({
            sessionId,
            lineItemId: lineItem.id,
            units: next,
          })
        }
      />
    </LineItemRowShell>
  );
}

export const ClaimLineItemRow = memo(ClaimLineItemRowImpl);
