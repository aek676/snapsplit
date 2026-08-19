import { describe, expect, it } from 'vitest';
import { receiptTotals } from '@/features/session/utils/receipt-totals';

function lineItem(lineTotalCents: number) {
  return {
    id: 'l1',
    name: 'Beer',
    quantity: 1,
    unitPriceCents: lineTotalCents,
    lineTotalCents,
    aiConfidence: 1,
    claims: [],
  };
}

describe('receiptTotals', () => {
  it('sums line totals', () => {
    const totals = receiptTotals({
      lineItems: [lineItem(600), lineItem(1400)],
      totalCents: 2000,
    });
    expect(totals.itemsTotalCents).toBe(2000);
    expect(totals.discrepancyCents).toBe(0);
    expect(totals.matches).toBe(true);
  });

  it('flags rounding discrepancies of a couple of cents', () => {
    const totals = receiptTotals({
      lineItems: [lineItem(999)],
      totalCents: 1001,
    });
    expect(totals.discrepancyCents).toBe(-2);
    expect(totals.matches).toBe(false);
  });

  it('flags larger discrepancies', () => {
    const totals = receiptTotals({
      lineItems: [lineItem(500)],
      totalCents: 1000,
    });
    expect(totals.discrepancyCents).toBe(-500);
    expect(totals.matches).toBe(false);
  });

  it('handles empty receipts', () => {
    const totals = receiptTotals({ lineItems: [], totalCents: 0 });
    expect(totals.matches).toBe(true);
  });
});
