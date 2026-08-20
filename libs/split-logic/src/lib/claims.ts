export type ClaimLike = { participantId: unknown; units: number };

export type ClaimedLineItem = { quantity: number; claims: ClaimLike[] };

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
