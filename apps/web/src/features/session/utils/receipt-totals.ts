import type { Session } from '@/types/session';

export type ReceiptTotals = {
  itemsTotalCents: number;
  discrepancyCents: number;
  matches: boolean;
};

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
    matches: discrepancyCents === 0,
  };
}
