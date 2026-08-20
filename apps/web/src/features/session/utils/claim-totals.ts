import { claimedUnits, remainingUnits } from '@repo/split-logic';
import type { LineItem, Session } from '@/types/session';

export { claimedUnits, remainingUnits };

export function myUnits(
  lineItem: LineItem,
  participantId: string | null,
): number {
  if (!participantId) return 0;

  return (
    lineItem.claims.find((claim) => claim.participantId === participantId)
      ?.units ?? 0
  );
}

export function collectedCents(session: Pick<Session, 'lineItems'>): number {
  return session.lineItems.reduce(
    (sum, item) => sum + claimedUnits(item) * item.unitPriceCents,
    0,
  );
}

export function myShareCents(
  session: Pick<Session, 'lineItems'>,
  participantId: string | null,
): number {
  return session.lineItems.reduce(
    (sum, item) => sum + myUnits(item, participantId) * item.unitPriceCents,
    0,
  );
}

/** Absolute upsert of a participant's claim, mirroring the API: 0 removes it. */
export function applyClaim(
  session: Session,
  lineItemId: string,
  participantId: string,
  units: number,
): Session {
  return {
    ...session,
    lineItems: session.lineItems.map((item) => {
      if (item.id !== lineItemId) return item;

      const others = item.claims.filter(
        (claim) => claim.participantId !== participantId,
      );
      return {
        ...item,
        claims: units === 0 ? others : [...others, { participantId, units }],
      };
    }),
  };
}

export function initials(name: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}
