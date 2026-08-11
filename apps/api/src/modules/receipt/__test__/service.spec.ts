import { describe, expect, it } from 'bun:test';
import { receiptFileId, receiptUrl } from '../service';

describe('receiptUrl', () => {
  it('builds the public path served by the receipt module', () => {
    expect(receiptUrl('abc.jpg')).toBe('/receipts/abc.jpg');
  });
});

describe('receiptFileId', () => {
  it('extracts the stored file id from a receipt url', () => {
    expect(receiptFileId('/receipts/abc.jpg')).toBe('abc.jpg');
  });

  it('round-trips whatever receiptUrl built', () => {
    expect(receiptFileId(receiptUrl('abc.jpg'))).toBe('abc.jpg');
  });

  it('returns null for a url that is not a receipt', () => {
    expect(receiptFileId('https://cdn.example.com/abc.jpg')).toBeNull();
  });

  it('returns null for the empty default url', () => {
    expect(receiptFileId('')).toBeNull();
    expect(receiptFileId('/receipts/')).toBeNull();
  });
});
