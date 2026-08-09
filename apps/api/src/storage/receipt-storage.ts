export {
  EXT_BY_MEDIA_TYPE,
  SUPPORTED_IMAGE_MIME_TYPES,
  type SupportedImageMimeType,
} from '@repo/shared-types';

export interface ReceiptStorage {
  save(bytes: Uint8Array, mediaType: string): Promise<{ id: string }>;
  get(id: string): Promise<{ bytes: Buffer; mediaType: string } | null>;
  delete(id: string): Promise<void>;
}
