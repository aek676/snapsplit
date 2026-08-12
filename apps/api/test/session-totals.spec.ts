import { describe, expect, it } from 'bun:test';
import { Types } from 'mongoose';
import type { ExtractedReceipt, ExtractReceipt } from '../src/ai/receipt';
import { createSessionModule } from '../src/modules/session';
import { SessionService } from '../src/modules/session/service';
import { Session } from '../src/schemas';
import { analyzeRequest } from './fixtures';
import { testStorage } from './setup';

/**
 * Characterization tests: they pin what the incremental `totalCents` arithmetic
 * does today, not what it should do. When the accumulator is replaced, the tests
 * that flip are the ones naming the gap.
 */

const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

/** Lines add up to 950, and every one of them reads clearly. */
const lineItems = [
  {
    name: 'Caña',
    quantity: 3,
    unitPriceCents: 200,
    lineTotalCents: 600,
    aiConfidence: 0.9,
  },
  {
    name: 'Tapa',
    quantity: 1,
    unitPriceCents: 350,
    lineTotalCents: 350,
    aiConfidence: 0.9,
  },
];

const receipt = (totalCents: number): ExtractedReceipt => ({
  merchant: 'Bar Paco',
  date: '2026-07-07',
  currency: 'EUR',
  totalCents,
  lineItems,
});

/** The printed total matches the lines the AI read. */
const coherent = receipt(950);
/** The AI read the printed total but missed lines worth 32.80. */
const overstated = receipt(4230);
/** The AI misread the printed total as lower than the lines it did read. */
const understated = receipt(100);

const extractOf =
  (extracted: ExtractedReceipt): ExtractReceipt =>
  async () =>
    extracted;

type SessionApp = ReturnType<typeof createSessionModule>;

const appFor = (extracted: ExtractedReceipt): SessionApp =>
  createSessionModule(new SessionService(extractOf(extracted), testStorage()));

const coherentApp = appFor(coherent);
const overstatedApp = appFor(overstated);
const understatedApp = appFor(understated);

type Draft = {
  id: string;
  totalCents: number;
  lineItems: { id: string; name: string; lineTotalCents: number }[];
  auth: { participantId: string; token: string };
};

async function createDraft(app: SessionApp) {
  const res = await app.handle(analyzeRequest());
  expect(res.status).toBe(200);
  return (await res.json()) as Draft;
}

function authorized(draft: Draft, extra: HeadersInit = {}) {
  return { authorization: `Bearer ${draft.auth.token}`, ...extra };
}

async function addLineItem(
  app: SessionApp,
  draft: Draft,
  body: { name: string; quantity: number; unitPriceCents: number },
) {
  const res = await app.handle(
    new Request(`http://localhost/sessions/${draft.id}/line-items`, {
      method: 'POST',
      headers: authorized(draft, { 'content-type': 'application/json' }),
      body: JSON.stringify(body),
    }),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as Draft;
}

async function patchLineItem(
  app: SessionApp,
  draft: Draft,
  lineItemId: string,
  patch: Partial<{ name: string; quantity: number; unitPriceCents: number }>,
) {
  const res = await app.handle(
    new Request(
      `http://localhost/sessions/${draft.id}/line-items/${lineItemId}`,
      {
        method: 'PATCH',
        headers: authorized(draft, { 'content-type': 'application/json' }),
        body: JSON.stringify(patch),
      },
    ),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as Draft;
}

async function removeLineItem(
  app: SessionApp,
  draft: Draft,
  lineItemId: string,
) {
  const res = await app.handle(
    new Request(
      `http://localhost/sessions/${draft.id}/line-items/${lineItemId}`,
      { method: 'DELETE', headers: authorized(draft) },
    ),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as Draft;
}

function confirm(app: SessionApp, draft: Draft) {
  return app.handle(
    new Request(`http://localhost/sessions/${draft.id}/confirm`, {
      method: 'POST',
      headers: authorized(draft),
    }),
  );
}

/** Measures the stored document, not the view the API hands back. */
async function storedTotals(sessionId: string) {
  const raw = await Session.collection.findOne({
    _id: new Types.ObjectId(sessionId),
  });
  if (!raw) throw new Error(`session ${sessionId} is gone`);

  const stored = raw as unknown as {
    totalCents: number;
    lineItems: { lineTotalCents: number }[];
  };
  const lineSum = stored.lineItems.reduce(
    (sum, item) => sum + item.lineTotalCents,
    0,
  );

  return {
    totalCents: stored.totalCents,
    lineSum,
    gap: stored.totalCents - lineSum,
    lineCount: stored.lineItems.length,
  };
}

describe('totalCents against the sum of the line items', () => {
  it('is born already apart when the receipt total outruns the lines', async () => {
    const draft = await createDraft(overstatedApp);

    expect(await storedTotals(draft.id)).toEqual({
      totalCents: 4230,
      lineSum: 950,
      gap: 3280,
      lineCount: 2,
    });
  });

  it('keeps the gap it was born with, whatever the owner edits', async () => {
    const draft = await createDraft(overstatedApp);
    expect((await storedTotals(draft.id)).gap).toBe(3280);

    const added = await addLineItem(overstatedApp, draft, {
      name: 'Vino',
      quantity: 2,
      unitPriceCents: 300,
    });
    expect(await storedTotals(draft.id)).toMatchObject({
      totalCents: 4830,
      lineSum: 1550,
      gap: 3280,
    });

    await patchLineItem(overstatedApp, draft, added.lineItems[0].id, {
      quantity: 5,
    });
    expect(await storedTotals(draft.id)).toMatchObject({
      totalCents: 5230,
      lineSum: 1950,
      gap: 3280,
    });

    await removeLineItem(overstatedApp, draft, added.lineItems[1].id);
    expect(await storedTotals(draft.id)).toMatchObject({
      totalCents: 4880,
      lineSum: 1600,
      gap: 3280,
    });
  });

  it('still claims 32.80 once every line is gone', async () => {
    const draft = await createDraft(overstatedApp);

    for (const lineItem of draft.lineItems)
      await removeLineItem(overstatedApp, draft, lineItem.id);

    expect(await storedTotals(draft.id)).toEqual({
      totalCents: 3280,
      lineSum: 0,
      gap: 3280,
      lineCount: 0,
    });
  });

  it('moves the gap on its own when the clamp catches a negative total', async () => {
    const draft = await createDraft(understatedApp);
    expect(await storedTotals(draft.id)).toMatchObject({
      totalCents: 100,
      lineSum: 950,
      gap: -850,
    });

    // 100 - 600 would be -500, so the clamp rewrites the total to 0.
    await removeLineItem(understatedApp, draft, draft.lineItems[0].id);

    expect(await storedTotals(draft.id)).toEqual({
      totalCents: 0,
      lineSum: 350,
      gap: -350,
      lineCount: 1,
    });
  });

  it('never drifts by itself: the arithmetic is exact when the seed is', async () => {
    const draft = await createDraft(coherentApp);
    expect(await storedTotals(draft.id)).toMatchObject({ gap: 0 });

    const withWine = await addLineItem(coherentApp, draft, {
      name: 'Vino',
      quantity: 2,
      unitPriceCents: 300,
    });
    const withDessert = await addLineItem(coherentApp, draft, {
      name: 'Postre',
      quantity: 1,
      unitPriceCents: 450,
    });
    await patchLineItem(coherentApp, draft, withDessert.lineItems[0].id, {
      quantity: 5,
    });
    await patchLineItem(coherentApp, draft, withDessert.lineItems[1].id, {
      unitPriceCents: 400,
    });
    await patchLineItem(coherentApp, draft, withWine.lineItems[2].id, {
      name: 'Vino tinto',
    });
    await removeLineItem(coherentApp, draft, withDessert.lineItems[3].id);

    expect(await storedTotals(draft.id)).toEqual({
      totalCents: 2000,
      lineSum: 2000,
      gap: 0,
      lineCount: 3,
    });
  });

  it('publishes the gap: confirm opens the session and nothing checks the total', async () => {
    const draft = await createDraft(overstatedApp);

    const res = await confirm(overstatedApp, draft);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; code: string };
    expect(body.status).toBe('open');
    expect(body.code).toMatch(CODE_PATTERN);
    expect(await storedTotals(draft.id)).toMatchObject({
      totalCents: 4230,
      lineSum: 950,
      gap: 3280,
    });
  });
});
