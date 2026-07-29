import { TanStackDevtools } from '@tanstack/react-devtools';
import { formDevtoolsPlugin } from '@tanstack/react-form-devtools';
import { RouterProvider } from '@tanstack/react-router';
import { AppProvider } from './provider';
import { router } from './router';

export function App() {
  return (
    <AppProvider>
      <RouterProvider router={router} />
      {import.meta.env.MODE !== 'test' && (
        <TanStackDevtools plugins={[formDevtoolsPlugin()]} />
      )}
    </AppProvider>
  );
}

export default App;
