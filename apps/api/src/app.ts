import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { connectDB } from './config/db';

await connectDB();

export const app = new Elysia()
  .use(cors())
  .get('/', () => ({ hello: 'snapsplit' }));

export type App = typeof app;
