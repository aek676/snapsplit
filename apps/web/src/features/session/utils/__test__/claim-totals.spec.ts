import { describe, expect, it } from 'vitest';
import {
  applyClaim,
  claimedUnits,
  collectedCents,
  initials,
  myShareCents,
  myUnits,
  remainingUnits,
} from '@/features/session/utils/claim-totals';
import type { LineItem, Session } from '@/types/session';

function lineItem(overrides: Partial<LineItem> = {}): LineItem {
  return {
    id: 'l1',
    name: 'Beer',
    quantity: 3,
    unitPriceCents: 200,
    lineTotalCents: 600,
    aiConfidence: 1,
    claims: [],
    ...overrides,
  };
}

function session(lineItems: LineItem[]): Session {
  return {
    id: 's1',
    code: null,
    status: 'open',
    merchant: null,
    date: null,
    currency: 'EUR',
    totalCents: 600,
    totalSource: 'receipt',
    receiptImageUrl: '',
    lineItems,
    participants: [],
  };
}

describe('unit math', () => {
  const item = lineItem({
    claims: [
      { participantId: 'p1', units: 2 },
      { participantId: 'p2', units: 1 },
    ],
  });

  it('sums claimed units', () => {
    expect(claimedUnits(item)).toBe(3);
    expect(claimedUnits(lineItem())).toBe(0);
  });

  it('derives remaining units', () => {
    expect(remainingUnits(item)).toBe(0);
    expect(remainingUnits(lineItem())).toBe(3);
  });

  it('finds my units', () => {
    expect(myUnits(item, 'p1')).toBe(2);
    expect(myUnits(item, 'p3')).toBe(0);
    expect(myUnits(item, null)).toBe(0);
  });
});

describe('session totals', () => {
  const fixture = session([
    lineItem({
      id: 'l1',
      claims: [
        { participantId: 'p1', units: 2 },
        { participantId: 'p2', units: 1 },
      ],
    }),
    lineItem({ id: 'l2', quantity: 2, unitPriceCents: 150 }),
  ]);

  it('sums collected cents', () => {
    expect(collectedCents(fixture)).toBe(600);
  });

  it('sums my share in cents', () => {
    expect(myShareCents(fixture, 'p1')).toBe(400);
    expect(myShareCents(fixture, null)).toBe(0);
  });
});

describe('applyClaim', () => {
  it('adds a claim', () => {
    const next = applyClaim(session([lineItem()]), 'l1', 'p1', 2);
    expect(next.lineItems[0].claims).toEqual([
      { participantId: 'p1', units: 2 },
    ]);
  });

  it('replaces my existing claim, keeping others', () => {
    const fixture = session([
      lineItem({
        claims: [
          { participantId: 'p2', units: 1 },
          { participantId: 'p1', units: 2 },
        ],
      }),
    ]);
    const next = applyClaim(fixture, 'l1', 'p1', 1);
    expect(next.lineItems[0].claims).toEqual([
      { participantId: 'p2', units: 1 },
      { participantId: 'p1', units: 1 },
    ]);
  });

  it('removes the claim at zero units', () => {
    const fixture = session([
      lineItem({ claims: [{ participantId: 'p1', units: 2 }] }),
    ]);
    const next = applyClaim(fixture, 'l1', 'p1', 0);
    expect(next.lineItems[0].claims).toEqual([]);
  });

  it('leaves other items untouched', () => {
    const fixture = session([lineItem({ id: 'l1' }), lineItem({ id: 'l2' })]);
    const next = applyClaim(fixture, 'l1', 'p1', 1);
    expect(next.lineItems[1]).toBe(fixture.lineItems[1]);
  });

  it('does not mutate the original session', () => {
    const fixture = session([lineItem()]);
    applyClaim(fixture, 'l1', 'p1', 2);
    expect(fixture.lineItems[0].claims).toEqual([]);
  });
});

describe('initials', () => {
  it('uses the first letters of the first two words', () => {
    expect(initials('Ana')).toBe('A');
    expect(initials('ana garcía')).toBe('AG');
    expect(initials('Ana García López')).toBe('AG');
  });

  it('falls back to a question mark', () => {
    expect(initials(null)).toBe('?');
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
  });
});
