import { describe, expect, it } from 'bun:test';
import { createReceiptStorage } from '../index';

describe('createReceiptStorage', () => {
  it('builds a storage without reading the process environment', () => {
    const storage = createReceiptStorage({ S3_BUCKET: 'a-bucket' });

    expect(typeof storage.save).toBe('function');
    expect(typeof storage.get).toBe('function');
    expect(typeof storage.delete).toBe('function');
  });

  it('defers client construction, so a missing bucket only fails on use', () => {
    const storage = createReceiptStorage({});

    expect(storage.get('any-key')).rejects.toThrow('S3_BUCKET is not set');
  });
});
