import { afterAll, beforeAll, beforeEach } from 'bun:test';
import { Storage } from '@google-cloud/storage';
import {
  MongoDBContainer,
  type StartedMongoDBContainer,
} from '@testcontainers/mongodb';
import mongoose from 'mongoose';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { createReceiptStorage } from '../src/storage';
import type { ObjectStorage } from '../src/storage/object-storage';

const STARTUP_TIMEOUT_MS = 180_000;

const DATABASE_NAME = 'snapsplit-test';

/** The emulator never seeds buckets on its own, so the setup creates this one. */
export const TEST_BUCKET = 'snapsplit-test-receipts';

/** Mirrors the prefix `createReceiptStorage` puts every receipt under. */
const RECEIPT_PREFIX = 'receipts';

const GCS_PORT = 4443;

let mongoContainer: StartedMongoDBContainer;
let gcsContainer: StartedTestContainer;
let gcsClient: Storage;

/** `http://host:port` of the emulator, with the port Docker happened to pick. */
export let gcsEndpoint: string;

beforeAll(
  async () => {
    [mongoContainer, gcsContainer] = await Promise.all([
      new MongoDBContainer('mongo:7.0').start(),
      new GenericContainer('fsouza/fake-gcs-server:1.52.2')
        .withExposedPorts(GCS_PORT)
        .withCommand([
          '-scheme',
          'http',
          '-host',
          '0.0.0.0',
          '-port',
          String(GCS_PORT),
        ])
        .start(),
    ]);

    const mongoUri = `${mongoContainer.getConnectionString()}/?directConnection=true`;

    gcsEndpoint = `http://${gcsContainer.getHost()}:${gcsContainer.getMappedPort(GCS_PORT)}`;

    await Promise.all([
      mongoose.connect(mongoUri, { dbName: DATABASE_NAME }),
      startEmulatorBucket(),
    ]);
  },
  { timeout: STARTUP_TIMEOUT_MS },
);

beforeEach(async () => {
  await Promise.all([resetDatabase(), resetBucket()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await Promise.all([mongoContainer?.stop(), gcsContainer?.stop()]);
});

/**
 * The emulator hands out download URLs built from the port it was told about,
 * which is not the one Docker mapped. Announcing the real one keeps
 * `file.download()` pointed at a reachable address.
 */
async function announceExternalUrl() {
  const res = await fetch(`${gcsEndpoint}/_internal/config`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ externalUrl: gcsEndpoint }),
  });
  if (!res.ok) throw new Error(`fake-gcs config rejected: ${res.status}`);
}

/** The container answers a moment after its port opens, so keep knocking. */
async function startEmulatorBucket() {
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await announceExternalUrl();
      gcsClient = new Storage({ apiEndpoint: gcsEndpoint, projectId: 'dev' });
      await gcsClient.createBucket(TEST_BUCKET);
      return;
    } catch (error) {
      lastError = error;
      await Bun.sleep(200);
    }
  }
  throw new Error(`fake-gcs never became usable: ${lastError}`);
}

export async function resetDatabase() {
  const db = mongoose.connection.db;
  if (!db) return;

  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

export async function resetBucket() {
  await gcsClient?.bucket(TEST_BUCKET).deleteFiles({ force: true });
}

/**
 * The same storage the app builds in production, pointed at the emulator — so
 * the tests exercise the real `GcsObjectStorage`, prefix and all.
 *
 * Specs build their module at import time, before `beforeAll` knows which port
 * Docker picked, so the real storage is resolved on first use instead.
 */
export function testStorage(): ObjectStorage {
  let delegate: ObjectStorage | undefined;
  const resolve = () => {
    if (!gcsEndpoint) throw new Error('fake-gcs is not running yet');
    delegate ??= createReceiptStorage({
      GCS_BUCKET: TEST_BUCKET,
      GCS_EMULATOR_HOST: gcsEndpoint,
    });
    return delegate;
  };

  return {
    save: (key, bytes, mediaType) => resolve().save(key, bytes, mediaType),
    get: (key) => resolve().get(key),
    delete: (key) => resolve().delete(key),
  };
}

/** Raw handle on a stored receipt, for assertions the interface cannot make. */
export function bucketFile(key: string) {
  return gcsClient.bucket(TEST_BUCKET).file(`${RECEIPT_PREFIX}/${key}`);
}

export async function storedReceipts() {
  const [files] = await gcsClient.bucket(TEST_BUCKET).getFiles();
  return files.map((file) => file.name);
}
