import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';

export const app = new Elysia()
  .use(cors())
  .get('/', () => ({ hello: 'snapsplit' }));

export type App = typeof app;
