import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { routeTree } from '@/app/route-tree.gen';
import { setToken } from '@/utils/device-token';

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
    renderAt('/sessions/507f1f77bcf86cd799439011/review');
    expect(await screen.findByText('Split the bill, snap it')).toBeDefined();
  });

  it('lets the review screen load with a device token', async () => {
    setToken('507f1f77bcf86cd799439011', {
      participantId: 'participant-1',
      token: 'device-token',
    });

    renderAt('/sessions/507f1f77bcf86cd799439011/review');
    expect(await screen.findByText(/couldn't load this session/i)).toBeDefined();
  });
});
