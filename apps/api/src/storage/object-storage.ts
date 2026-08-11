export {
  EXT_BY_MEDIA_TYPE,
  SUPPORTED_IMAGE_MIME_TYPES,
  type SupportedImageMimeType,
} from '@repo/shared-types';

export interface ObjectStorage {
  save(key: string, bytes: Uint8Array, mediaType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Buffer; mediaType: string } | null>;
  delete(key: string): Promise<void>;
}
