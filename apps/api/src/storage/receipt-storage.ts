/**
 * Backend-agnostic storage for receipt images. Implementations (GCS, S3, local
 * disk…) can be swapped without touching the session service or the endpoints.
 */
export interface ReceiptStorage {
  /** Stores the image bytes and returns an opaque id used to retrieve it later. */
  save(bytes: Uint8Array, mediaType: string): Promise<{ id: string }>;
  /** Returns the stored bytes + media type, or null if the id does not exist. */
  get(id: string): Promise<{ bytes: Buffer; mediaType: string } | null>;
  /** Best-effort delete; must not throw if the object is already gone. */
  delete(id: string): Promise<void>;
}
