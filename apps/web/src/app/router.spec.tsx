import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { routeTree } from '@/app/route-tree.gen';

function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('router', () => {
  it('renders the home screen on /', async () => {
    renderAt('/');
    expect(await screen.findByText('Split the bill, snap it')).toBeDefined();
  });

  it('renders the guest stub on /s/$code', async () => {
    renderAt('/s/AB7K9');
    expect(await screen.findByText(/coming soon/i)).toBeDefined();
  });
});
