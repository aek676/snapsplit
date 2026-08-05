import { afterAll, beforeAll, beforeEach } from 'bun:test';
import {
  MongoDBContainer,
  type StartedMongoDBContainer,
} from '@testcontainers/mongodb';
import mongoose from 'mongoose';

const STARTUP_TIMEOUT_MS = 180_000;

const DATABASE_NAME = 'snapsplit-test';

let mongoContainer: StartedMongoDBContainer;

beforeAll(
  async () => {
    mongoContainer = await new MongoDBContainer('mongo:7.0').start();

    const mongoUri = `${mongoContainer.getConnectionString()}/?directConnection=true`;

    await mongoose.connect(mongoUri, { dbName: DATABASE_NAME });
  },
  { timeout: STARTUP_TIMEOUT_MS },
);

beforeEach(resetDatabase);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoContainer?.stop();
});

export async function resetDatabase() {
  const db = mongoose.connection.db;
  if (!db) return;

  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}
