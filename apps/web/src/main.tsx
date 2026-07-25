import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Toaster } from 'shadcn-ui/toast';
import App from './app/app';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>,
);
