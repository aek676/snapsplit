import { randomUUID } from 'node:crypto';
import { type Bucket, Storage } from '@google-cloud/storage';
import type { ReceiptStorage } from './receipt-storage';

const PREFIX = 'receipts';

const EXT_BY_MEDIA_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function extFromMediaType(mediaType: string): string {
  return EXT_BY_MEDIA_TYPE[mediaType] ?? 'bin';
}

/**
 * Google Cloud Storage implementation of {@link ReceiptStorage}.
 *
 * - Production: `new Storage()` resolves credentials via ADC (the runtime's
 *   service account on Cloud Run/GKE).
 * - Development: when `GCS_EMULATOR_HOST` is set, the client targets the
 *   fake-gcs-server emulator (compose.yaml) — same code path, no GCP creds.
 *   We deliberately do NOT use the SDK-reserved `STORAGE_EMULATOR_HOST`: when
 *   that env var is present the SDK enters an auto-emulator mode that conflicts
 *   with our explicit `apiEndpoint` and 404s uploads/downloads against
 *   fake-gcs. Passing `apiEndpoint` ourselves is the reliable path.
 *
 * The bucket handle is created lazily on first use so that importing this module
 * (e.g. in unit tests) does not require `GCS_BUCKET` to be set.
 */
export class GcsReceiptStorage implements ReceiptStorage {
  private bucketInstance?: Bucket;
  private ensured = false;

  constructor(private readonly bucketName = Bun.env.GCS_BUCKET) {}

  private get isEmulator(): boolean {
    return Boolean(Bun.env.GCS_EMULATOR_HOST);
  }

  private bucket(): Bucket {
    if (!this.bucketInstance) {
      if (!this.bucketName) throw new Error('GCS_BUCKET is not set');
      const emulator = Bun.env.GCS_EMULATOR_HOST;
      const storage = emulator
        ? new Storage({ apiEndpoint: emulator, projectId: 'dev' })
        : new Storage();
      this.bucketInstance = storage.bucket(this.bucketName);
    }
    return this.bucketInstance;
  }

  /** In dev the emulator starts empty, so create the bucket on first use. */
  private async ensureBucket(): Promise<void> {
    if (!this.isEmulator || this.ensured) return;
    const [exists] = await this.bucket().exists();
    if (!exists) await this.bucket().create();
    this.ensured = true;
  }

  async save(bytes: Uint8Array, mediaType: string): Promise<{ id: string }> {
    await this.ensureBucket();
    const id = `${randomUUID()}.${extFromMediaType(mediaType)}`;
    await this.bucket()
      .file(`${PREFIX}/${id}`)
      .save(Buffer.from(bytes), { contentType: mediaType });
    return { id };
  }

  async get(id: string): Promise<{ bytes: Buffer; mediaType: string } | null> {
    const file = this.bucket().file(`${PREFIX}/${id}`);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [metadata] = await file.getMetadata();
    const [bytes] = await file.download();
    return {
      bytes,
      mediaType: metadata.contentType ?? 'application/octet-stream',
    };
  }

  async delete(id: string): Promise<void> {
    await this.bucket()
      .file(`${PREFIX}/${id}`)
      .delete({ ignoreNotFound: true });
  }
}

export const gcsReceiptStorage = new GcsReceiptStorage();
