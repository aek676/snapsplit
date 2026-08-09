import { GcsObjectStorage } from './gcs';
import type { ObjectStorage } from './object-storage';

type StorageEnv = Partial<Pick<Bun.Env, 'GCS_BUCKET' | 'GCS_EMULATOR_HOST'>>;

export function createReceiptStorage(env: StorageEnv = Bun.env): ObjectStorage {
  return new GcsObjectStorage({
    prefix: 'receipts',
    bucketName: env.GCS_BUCKET,
    apiEndpoint: env.GCS_EMULATOR_HOST,
  });
}

export const receiptStorage: ObjectStorage = createReceiptStorage();
