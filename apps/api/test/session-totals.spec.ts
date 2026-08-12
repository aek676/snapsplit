import { describe, expect, it } from 'bun:test';
import { Types } from 'mongoose';
import type { ExtractedReceipt, ExtractReceipt } from '../src/ai/receipt';
import { createSessionModule } from '../src/modules/session';
import { SessionService } from '../src/modules/session/service';
import { Session } from '../src/schemas';
import { analyzeRequest } from './fixtures';
import { testStorage } from './setup';

/**
 * `totalCents` holds the total printed on the receipt, read once by the AI and
 * never moved by an edit. The line items are what the owner reconciles against
 * it, and confirm is the gate: a draft only publishes when the two agree.
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
/** The AI read the printed total but missed a line worth 1.50. */
const overstated = receipt(1100);
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

function patchSession(
  app: SessionApp,
  draft: Draft,
  patch: Partial<{ merchant: string; date: string; totalCents: number }>,
) {
  return app.handle(
    new Request(`http://localhost/sessions/${draft.id}`, {
      method: 'PATCH',
      headers: authorized(draft, { 'content-type': 'application/json' }),
      body: JSON.stringify(patch),
    }),
  );
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
  it('is born apart when the receipt total outruns the lines', async () => {
    const draft = await createDraft(overstatedApp);

    expect(await storedTotals(draft.id)).toEqual({
      totalCents: 1100,
      lineSum: 950,
      gap: 150,
      lineCount: 2,
    });
  });

  it('holds the printed total still while the owner edits lines', async () => {
    const draft = await createDraft(overstatedApp);

    const added = await addLineItem(overstatedApp, draft, {
      name: 'Vino',
      quantity: 2,
      unitPriceCents: 300,
    });
    expect(await storedTotals(draft.id)).toMatchObject({
      totalCents: 1100,
      lineSum: 1550,
    });

    await patchLineItem(overstatedApp, draft, added.lineItems[0].id, {
      quantity: 5,
    });
    expect(await storedTotals(draft.id)).toMatchObject({
      totalCents: 1100,
      lineSum: 1950,
    });

    await removeLineItem(overstatedApp, draft, added.lineItems[1].id);
    expect(await storedTotals(draft.id)).toMatchObject({
      totalCents: 1100,
      lineSum: 1600,
    });
  });

  it('still reads the printed total once every line is gone', async () => {
    const draft = await createDraft(overstatedApp);

    for (const lineItem of draft.lineItems)
      await removeLineItem(overstatedApp, draft, lineItem.id);

    expect(await storedTotals(draft.id)).toEqual({
      totalCents: 1100,
      lineSum: 0,
      gap: 1100,
      lineCount: 0,
    });
  });

  it('never rewrites a total the lines have overshot', async () => {
    const draft = await createDraft(understatedApp);

    // Dropping 6.00 worth of lines used to drive the total negative and clamp
    // it to 0. It is not the running tally any more, so it does not move.
    await removeLineItem(understatedApp, draft, draft.lineItems[0].id);

    expect(await storedTotals(draft.id)).toEqual({
      totalCents: 100,
      lineSum: 350,
      gap: -250,
      lineCount: 1,
    });
  });
});

describe('confirming a draft against its receipt total', () => {
  it('refuses to publish while the lines fall short', async () => {
    const draft = await createDraft(overstatedApp);

    const res = await confirm(overstatedApp, draft);

    expect(res.status).toBe(409);
    expect(await res.text()).toBe('Items do not add up to the receipt total');
    expect(await storedTotals(draft.id)).toMatchObject({ gap: 150 });
  });

  it('publishes once the owner keys in the line the AI missed', async () => {
    const draft = await createDraft(overstatedApp);

    await addLineItem(overstatedApp, draft, {
      name: 'Café',
      quantity: 1,
      unitPriceCents: 150,
    });
    const res = await confirm(overstatedApp, draft);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; code: string };
    expect(body.status).toBe('open');
    expect(body.code).toMatch(CODE_PATTERN);
    expect(await storedTotals(draft.id)).toMatchObject({
      totalCents: 1100,
      lineSum: 1100,
      gap: 0,
    });
  });

  it('publishes once the owner corrects a total the AI misread', async () => {
    const draft = await createDraft(understatedApp);

    const patched = await patchSession(understatedApp, draft, {
      totalCents: 950,
    });
    expect(patched.status).toBe(200);

    const res = await confirm(understatedApp, draft);

    expect(res.status).toBe(200);
    expect(await storedTotals(draft.id)).toMatchObject({ gap: 0 });
  });

  it('publishes a draft that was already balanced when it arrived', async () => {
    const draft = await createDraft(coherentApp);

    const res = await confirm(coherentApp, draft);

    expect(res.status).toBe(200);
    expect((await res.json()).code).toMatch(CODE_PATTERN);
  });

  it('freezes the receipt total once the session is published', async () => {
    const draft = await createDraft(coherentApp);
    expect((await confirm(coherentApp, draft)).status).toBe(200);

    const res = await patchSession(coherentApp, draft, { totalCents: 5000 });

    expect(res.status).toBe(409);
    expect(await res.text()).toBe('Session is not editable');
    expect(await storedTotals(draft.id)).toMatchObject({ totalCents: 950 });
  });
});
