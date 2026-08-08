import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routeTree } from '@/app/route-tree.gen';
import { serve } from '@/testing/respond';
import { setToken } from '@/utils/device-token';
import { formatCents } from '@/utils/money';

const SESSION_ID = '507f1f77bcf86cd799439011';

const session = {
  id: SESSION_ID,
  status: 'draft',
  merchant: 'Bar Manolo',
  date: '2026-08-06',
  currency: 'EUR',
  totalCents: 1250,
  receiptImageUrl: '/receipts/stored-123',
  lineItems: [
    {
      id: 'line-1',
      name: 'Vino de la casa',
      quantity: 1,
      unitPriceCents: 1250,
      lineTotalCents: 1250,
      aiConfidence: 0.97,
    },
  ],
};

function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('router', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('renders the home screen on /', async () => {
    renderAt('/');
    expect(await screen.findByText('Split the bill, snap it')).toBeDefined();
  });

  it('renders the guest stub on /s/$code', async () => {
    renderAt('/s/AB7K9');
    expect(await screen.findByText(/coming soon/i)).toBeDefined();
  });

  it('redirects the review screen home without a device token', async () => {
    renderAt(`/sessions/${SESSION_ID}/review`);
    expect(await screen.findByText('Split the bill, snap it')).toBeDefined();
  });

  it('lets the review screen load with a device token', async () => {
    setToken(SESSION_ID, {
      participantId: 'participant-1',
      token: 'device-token',
    });
    serve(200, session);

    renderAt(`/sessions/${SESSION_ID}/review`);

    expect(await screen.findByText('Review receipt')).toBeDefined();
    expect(await screen.findByText('Vino de la casa')).toBeDefined();
    const unitPrice = `${formatCents(1250, 'EUR')}/unit`.replace(/\s+/g, ' ');
    expect(await screen.findByText(unitPrice)).toBeDefined();
  });
});
