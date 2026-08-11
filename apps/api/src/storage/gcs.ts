import { type Bucket, Storage } from '@google-cloud/storage';
import type { ObjectStorage } from './object-storage';

export interface GcsObjectStorageOptions {
  prefix: string;
  bucketName?: string;
  apiEndpoint?: string;
}

export class GcsObjectStorage implements ObjectStorage {
  private readonly prefix: string;
  private readonly bucketName?: string;
  private readonly apiEndpoint?: string;
  private bucketInstance?: Bucket;

  constructor({ prefix, bucketName, apiEndpoint }: GcsObjectStorageOptions) {
    this.prefix = prefix;
    this.bucketName = bucketName;
    this.apiEndpoint = apiEndpoint;
  }

  private objectName(key: string): string {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  private bucket(): Bucket {
    if (!this.bucketInstance) {
      if (!this.bucketName) throw new Error('GCS_BUCKET is not set');
      const storage = this.apiEndpoint
        ? new Storage({ apiEndpoint: this.apiEndpoint, projectId: 'dev' })
        : new Storage();
      this.bucketInstance = storage.bucket(this.bucketName);
    }
    return this.bucketInstance;
  }

  async save(key: string, bytes: Uint8Array, mediaType: string): Promise<void> {
    // Receipts are capped well under 10MB and already sit in memory, so a
    // single-request upload beats opening a resumable session for them. It also
    // keeps the content type on the same request, which the emulator the
    // integration tests run against only honours in this mode.
    await this.bucket()
      .file(this.objectName(key))
      .save(Buffer.from(bytes), { contentType: mediaType, resumable: false });
  }

  async get(key: string): Promise<{ bytes: Buffer; mediaType: string } | null> {
    const file = this.bucket().file(this.objectName(key));
    const [exists] = await file.exists();
    if (!exists) return null;
    const [metadata] = await file.getMetadata();
    const [bytes] = await file.download();
    return {
      bytes,
      mediaType: metadata.contentType ?? 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    await this.bucket()
      .file(this.objectName(key))
      .delete({ ignoreNotFound: true });
  }
}
