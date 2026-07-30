// Global test setup for the web app (Vitest + jsdom).
import { configure } from '@testing-library/dom';

// Routes are lazily code-split (`autoCodeSplitting`), so a cold CI runner can
// take longer than the 1s default to resolve the first route chunk.
configure({ asyncUtilTimeout: 5000 });
