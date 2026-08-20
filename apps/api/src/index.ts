import closeWithGrace from 'close-with-grace';
import { app } from './app';
import { connectDB, disconnectDB } from './config/db';
import { createCloseHandler, createShutdownDeps } from './config/shutdown';
import { sessionEvents } from './modules/session/events';

await connectDB();

const PORT = Number(Bun.env.PORT ?? 3000);

app.listen(PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

closeWithGrace(
  { delay: 10_000 },
  createCloseHandler(
    createShutdownDeps({
      app,
      events: sessionEvents,
      disconnect: disconnectDB,
    }),
  ),
);
