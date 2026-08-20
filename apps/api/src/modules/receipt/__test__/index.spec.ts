import { describe, expect, it, mock } from 'bun:test';
import type { ObjectStorage } from '../../../storage/object-storage';
import { createReceiptModule } from '../index';
import { newReceiptFileId, receiptUrl } from '../service';

function fakeStorage(overrides: Partial<ObjectStorage> = {}): ObjectStorage {
  return {
    save: mock(async () => {}),
    get: mock(async () => null),
    delete: mock(async () => {}),
    ...overrides,
  };
}

function get(storage: ObjectStorage, path: string) {
  return createReceiptModule(storage).handle(
    new Request(`http://localhost${path}`),
  );
}

describe('GET /receipts/:fileId', () => {
  // A 200 is only reachable if the route matched, so this fails the moment the
  // module prefix and receiptUrl() stop agreeing on the same path.
  it('serves the path that receiptUrl builds', async () => {
    const storage = fakeStorage({
      get: mock(async () => ({
        bytes: Buffer.from([1, 2, 3]),
        mediaType: 'image/png',
      })),
    });

    const fileId = newReceiptFileId('image/png');
    const res = await get(storage, receiptUrl(fileId));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe(
      'private, max-age=31536000, immutable',
    );
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(storage.get).toHaveBeenCalledWith(fileId);
  });

  it('returns 404 when no image is stored under that id', async () => {
    const res = await get(
      fakeStorage(),
      receiptUrl(newReceiptFileId('image/png')),
    );

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not found');
  });

  it('serves ids with the fallback extension', async () => {
    const res = await get(
      fakeStorage(),
      receiptUrl(newReceiptFileId('application/pdf')),
    );

    expect(res.status).toBe(404);
  });

  it.each([
    ['a bare name', 'abc.png'],
    ['an uppercase uuid', '123E4567-E89B-42D3-A456-426614174000.png'],
    ['an unknown extension', '123e4567-e89b-42d3-a456-426614174000.exe'],
    ['a missing extension', '123e4567-e89b-42d3-a456-426614174000'],
    ['a traversal attempt', '..%2F123e4567-e89b-42d3-a456-426614174000.png'],
  ])('rejects %s without touching storage', async (_label, fileId) => {
    const storage = fakeStorage();

    const res = await get(storage, `/receipts/${fileId}`);

    expect(res.status).toBe(422);
    expect(storage.get).not.toHaveBeenCalled();
  });
});
