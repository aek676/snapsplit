export interface ReceiptStorage {
  save(bytes: Uint8Array, mediaType: string): Promise<{ id: string }>;
  get(id: string): Promise<{ bytes: Buffer; mediaType: string } | null>;
  delete(id: string): Promise<void>;
}
