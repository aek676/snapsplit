import { describe, expect, it } from 'bun:test';
import { receiptBytes } from './fixtures';
import { storedReceipts, testStorage } from './setup';

const storage = testStorage();

describe('S3ObjectStorage against MinIO', () => {
  it('round-trips the bytes and the media type', async () => {
    await storage.save('receipt.png', receiptBytes, 'image/png');

    const found = await storage.get('receipt.png');

    expect(found).not.toBeNull();
    expect(found?.mediaType).toBe('image/png');
    expect(Uint8Array.from(found?.bytes ?? [])).toEqual(receiptBytes);
  });

  it('files every object under the receipts prefix', async () => {
    await storage.save('receipt.png', receiptBytes, 'image/png');

    expect(await storedReceipts()).toEqual(['receipts/receipt.png']);
  });

  it('resolves an unknown key to null instead of throwing', async () => {
    expect(await storage.get('nunca-subido.png')).toBeNull();
  });

  it('deletes a stored object', async () => {
    await storage.save('receipt.png', receiptBytes, 'image/png');

    await storage.delete('receipt.png');

    expect(await storage.get('receipt.png')).toBeNull();
    expect(await storedReceipts()).toEqual([]);
  });

  it('ignores a delete of a key that is not there', async () => {
    await expect(storage.delete('nunca-subido.png')).resolves.toBeUndefined();
  });

  it('overwrites a key that already holds an object', async () => {
    const replacement = new TextEncoder().encode('not a png anymore');
    await storage.save('receipt.png', receiptBytes, 'image/png');

    await storage.save('receipt.png', replacement, 'text/plain');

    const found = await storage.get('receipt.png');
    expect(found?.mediaType).toBe('text/plain');
    expect(Uint8Array.from(found?.bytes ?? [])).toEqual(replacement);
    expect(await storedReceipts()).toEqual(['receipts/receipt.png']);
  });
});
