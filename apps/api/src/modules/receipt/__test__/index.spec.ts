import { describe, expect, it, mock } from 'bun:test';
import type { ObjectStorage } from '../../../storage/object-storage';
import { createReceiptModule } from '../index';
import { receiptUrl } from '../service';

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

    const res = await get(storage, receiptUrl('abc.png'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(storage.get).toHaveBeenCalledWith('abc.png');
  });

  it('returns 404 when no image is stored under that id', async () => {
    const res = await get(fakeStorage(), receiptUrl('missing.png'));

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not found');
  });
});
