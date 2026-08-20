import { describe, expect, it } from 'bun:test';
import { claimedUnits, remainingUnits, unclaimedUnits } from './claims';

const objectIdLike = (id: string) => ({ toString: () => id });

describe('claimedUnits', () => {
  it('sums the units across all claims', () => {
    const lineItem = {
      quantity: 5,
      claims: [
        { participantId: 'p1', units: 2 },
        { participantId: 'p2', units: 1 },
      ],
    };

    expect(claimedUnits(lineItem)).toBe(3);
  });

  it('sums to zero without claims', () => {
    expect(claimedUnits({ quantity: 5, claims: [] })).toBe(0);
  });

  it('excludes one participant', () => {
    const lineItem = {
      quantity: 5,
      claims: [
        { participantId: 'p1', units: 2 },
        { participantId: 'p2', units: 1 },
      ],
    };

    expect(claimedUnits(lineItem, 'p1')).toBe(1);
  });

  it('excludes a participant identified by an ObjectId-like value', () => {
    const lineItem = {
      quantity: 5,
      claims: [
        { participantId: objectIdLike('p1'), units: 2 },
        { participantId: objectIdLike('p2'), units: 1 },
      ],
    };

    expect(claimedUnits(lineItem, 'p1')).toBe(1);
  });
});

describe('remainingUnits', () => {
  it('subtracts the claimed units from the quantity', () => {
    const lineItem = {
      quantity: 5,
      claims: [{ participantId: 'p1', units: 2 }],
    };

    expect(remainingUnits(lineItem)).toBe(3);
  });
});

describe('unclaimedUnits', () => {
  it('sums the remaining units across every line item', () => {
    const session = {
      lineItems: [
        { quantity: 5, claims: [{ participantId: 'p1', units: 2 }] },
        { quantity: 3, claims: [] },
      ],
    };

    expect(unclaimedUnits(session)).toBe(6);
  });

  it('sums to zero once everything is claimed', () => {
    const session = {
      lineItems: [
        { quantity: 2, claims: [{ participantId: 'p1', units: 2 }] },
        { quantity: 1, claims: [{ participantId: 'p2', units: 1 }] },
      ],
    };

    expect(unclaimedUnits(session)).toBe(0);
  });

  it('sums to zero without line items', () => {
    expect(unclaimedUnits({ lineItems: [] })).toBe(0);
  });
});
