import type { Session } from '@/types/session';

export const TOTAL_TOLERANCE_CENTS = 2;

export interface ReceiptTotals {
  itemsTotalCents: number;
  discrepancyCents: number;
  matches: boolean;
}

export function receiptTotals(
  session: Pick<Session, 'lineItems' | 'totalCents'>,
): ReceiptTotals {
  const itemsTotalCents = session.lineItems.reduce(
    (sum, item) => sum + item.lineTotalCents,
    0,
  );
  const discrepancyCents = itemsTotalCents - session.totalCents;
  return {
    itemsTotalCents,
    discrepancyCents,
    matches: Math.abs(discrepancyCents) <= TOTAL_TOLERANCE_CENTS,
  };
}
