import { app } from './app';
import { connectDB } from './config/db';

await connectDB();

app.listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

export type { App } from './app';
