// participantId is an ObjectId on the API and a plain string on the web;
// String() gives both the same identity for comparison.
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
