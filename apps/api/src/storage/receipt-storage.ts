export const EXT_BY_MEDIA_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const;

export type SupportedImageMimeType = keyof typeof EXT_BY_MEDIA_TYPE;

export const SUPPORTED_IMAGE_MIME_TYPES = Object.keys(
  EXT_BY_MEDIA_TYPE,
) as SupportedImageMimeType[];

export interface ReceiptStorage {
  save(bytes: Uint8Array, mediaType: string): Promise<{ id: string }>;
  get(id: string): Promise<{ bytes: Buffer; mediaType: string } | null>;
  delete(id: string): Promise<void>;
}
