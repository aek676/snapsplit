import { createRouter } from '@tanstack/react-router';
import { routeTree } from '@/app/route-tree.gen';

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: declaration merging into a module augmentation only works with an interface
  interface Register {
    router: typeof router;
  }
}
