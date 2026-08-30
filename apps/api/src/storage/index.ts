import type { ObjectStorage } from './object-storage';
import { S3ObjectStorage } from './s3';

type StorageEnv = Partial<
  Pick<
    Bun.Env,
    | 'S3_BUCKET'
    | 'S3_ENDPOINT'
    | 'S3_REGION'
    | 'S3_ACCESS_KEY_ID'
    | 'S3_SECRET_ACCESS_KEY'
  >
>;

export function createReceiptStorage(env: StorageEnv = Bun.env): ObjectStorage {
  return new S3ObjectStorage({
    prefix: 'receipts',
    bucket: env.S3_BUCKET,
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  });
}

export const receiptStorage: ObjectStorage = createReceiptStorage();
