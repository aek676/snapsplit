import { TanStackDevtools } from '@tanstack/react-devtools';
import { formDevtoolsPlugin } from '@tanstack/react-form-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { RouterProvider } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { AppProvider } from './provider';
import { router } from './router';

export function App() {
  return (
    <AppProvider>
      <RouterProvider router={router} />
      {import.meta.env.MODE === 'development' && (
        <TanStackDevtools
          plugins={[
            formDevtoolsPlugin(),
            {
              name: 'TanStack Query',
              render: <ReactQueryDevtoolsPanel />,
            },
            {
              name: 'TanStack Router',
              render: <TanStackRouterDevtoolsPanel router={router} />,
            },
          ]}
        />
      )}
    </AppProvider>
  );
}

export default App;
