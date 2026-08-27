import { S3Client } from 'bun';
import type { ObjectStorage } from './object-storage';

export interface S3ObjectStorageOptions {
  prefix: string;
  bucket?: string;
  endpoint?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

// Bun turns any 404 into an S3Error carrying this code, HEAD responses (which
// have no body to parse) included. A missing *bucket* is a configuration fault
// and keeps propagating.
function isMissingObject(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: unknown }).code === 'NoSuchKey';
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly prefix: string;
  private readonly options: Omit<S3ObjectStorageOptions, 'prefix'>;
  private clientInstance?: S3Client;

  constructor({ prefix, ...options }: S3ObjectStorageOptions) {
    this.prefix = prefix;
    this.options = options;
  }

  private objectName(key: string): string {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  private client(): S3Client {
    if (!this.clientInstance) {
      if (!this.options.bucket) throw new Error('S3_BUCKET is not set');
      // Path-style addressing (virtualHostedStyle defaults to false) is what
      // the OCI compatibility endpoint expects, and MinIO accepts either.
      this.clientInstance = new S3Client(this.options);
    }
    return this.clientInstance;
  }

  async save(key: string, bytes: Uint8Array, mediaType: string): Promise<void> {
    await this.client().write(this.objectName(key), bytes, { type: mediaType });
  }

  async get(key: string): Promise<{ bytes: Buffer; mediaType: string } | null> {
    const file = this.client().file(this.objectName(key));
    try {
      const [{ type }, bytes] = await Promise.all([
        file.stat(),
        file.arrayBuffer(),
      ]);
      return {
        bytes: Buffer.from(bytes),
        mediaType: type || 'application/octet-stream',
      };
    } catch (error) {
      if (isMissingObject(error)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client().delete(this.objectName(key));
    } catch (error) {
      if (!isMissingObject(error)) throw error;
    }
  }
}
