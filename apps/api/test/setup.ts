import { afterAll, beforeAll, beforeEach } from 'bun:test';
import { S3Client } from 'bun';
import {
  MinioContainer,
  type StartedMinioContainer,
} from '@testcontainers/minio';
import {
  MongoDBContainer,
  type StartedMongoDBContainer,
} from '@testcontainers/mongodb';
import mongoose from 'mongoose';
import {
  analyzeRateLimitContext,
  availabilityRateLimitContext,
  joinRateLimitContext,
} from '../src/plugins/rate-limit';
import { createReceiptStorage } from '../src/storage';
import type { ObjectStorage } from '../src/storage/object-storage';

const STARTUP_TIMEOUT_MS = 180_000;
const DATABASE_NAME = 'snapsplit-test';
export const TEST_BUCKET = 'snapsplit-test-receipts';
const RECEIPT_PREFIX = 'receipts';
// MinIO signs against this region unless told otherwise.
const TEST_REGION = 'us-east-1';

let mongoContainer: StartedMongoDBContainer;
let minioContainer: StartedMinioContainer;
let s3Client: S3Client;
let s3Env: Record<string, string> | undefined;

beforeAll(
  async () => {
    [mongoContainer, minioContainer] = await Promise.all([
      new MongoDBContainer('mongo:7.0').start(),
      new MinioContainer('minio/minio:RELEASE.2025-09-07T16-13-09Z').start(),
    ]);

    const mongoUri = `${mongoContainer.getConnectionString()}/?directConnection=true`;
    s3Env = {
      S3_ENDPOINT: minioContainer.getConnectionUrl(),
      S3_REGION: TEST_REGION,
      S3_BUCKET: TEST_BUCKET,
      S3_ACCESS_KEY_ID: minioContainer.getUsername(),
      S3_SECRET_ACCESS_KEY: minioContainer.getPassword(),
    };
    s3Client = new S3Client({
      endpoint: s3Env.S3_ENDPOINT,
      region: TEST_REGION,
      bucket: TEST_BUCKET,
      accessKeyId: s3Env.S3_ACCESS_KEY_ID,
      secretAccessKey: s3Env.S3_SECRET_ACCESS_KEY,
    });

    await Promise.all([
      mongoose.connect(mongoUri, { dbName: DATABASE_NAME }),
      createTestBucket(),
    ]);
  },
  { timeout: STARTUP_TIMEOUT_MS },
);

beforeEach(async () => {
  await Promise.all([
    resetDatabase(),
    resetBucket(),
    joinRateLimitContext.reset(),
    availabilityRateLimitContext.reset(),
    analyzeRateLimitContext.reset(),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await Promise.all([mongoContainer?.stop(), minioContainer?.stop()]);
});

async function createTestBucket() {
  const alias = `http://${minioContainer.getUsername()}:${minioContainer.getPassword()}@localhost:9000`;
  const { exitCode, output } = await minioContainer.exec(
    ['mc', 'mb', '--ignore-existing', `local/${TEST_BUCKET}`],
    { env: { MC_HOST_local: alias } },
  );
  if (exitCode !== 0) {
    throw new Error(`could not create the ${TEST_BUCKET} bucket: ${output}`);
  }
}

export async function resetDatabase() {
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

export async function resetBucket() {
  if (!s3Client) return;
  const { contents } = await s3Client.list();
  await Promise.all(
    (contents ?? []).map((object) => s3Client.delete(object.key)),
  );
}

export function testStorage(): ObjectStorage {
  let delegate: ObjectStorage | undefined;
  const resolve = () => {
    if (!s3Env) throw new Error('MinIO is not running yet');
    delegate ??= createReceiptStorage(s3Env);
    return delegate;
  };
  return {
    save: (key, bytes, mediaType) => resolve().save(key, bytes, mediaType),
    get: (key) => resolve().get(key),
    delete: (key) => resolve().delete(key),
  };
}

export function receiptExists(key: string): Promise<boolean> {
  return s3Client.file(`${RECEIPT_PREFIX}/${key}`).exists();
}

export async function storedReceipts() {
  const { contents } = await s3Client.list();
  return (contents ?? []).map((object) => object.key);
}
