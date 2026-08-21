export type ClaimLike = { participantId: unknown; units: number };

export type ClaimedLineItem = { quantity: number; claims: ClaimLike[] };

export type ClaimedSession = { lineItems: ClaimedLineItem[] };

export function claimedUnits(
  lineItem: ClaimedLineItem,
  excludeParticipantId?: string,
): number {
  return lineItem.claims.reduce(
    (sum, claim) =>
      String(claim.participantId) === excludeParticipantId
        ? sum
        : sum + claim.units,
    0,
  );
}

export function remainingUnits(lineItem: ClaimedLineItem): number {
  return lineItem.quantity - claimedUnits(lineItem);
}

export function unclaimedUnits(session: ClaimedSession): number {
  return session.lineItems.reduce((sum, item) => sum + remainingUnits(item), 0);
}
