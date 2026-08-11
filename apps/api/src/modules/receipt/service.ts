import { randomUUID } from 'node:crypto';
import {
  EXT_BY_MEDIA_TYPE,
  type SupportedImageMimeType,
} from '../../storage/object-storage';

export const RECEIPT_BASE_PATH = '/receipts';

export function newReceiptFileId(mediaType: string) {
  const ext = EXT_BY_MEDIA_TYPE[mediaType as SupportedImageMimeType] ?? 'bin';
  return `${randomUUID()}.${ext}`;
}

export function receiptUrl(id: string) {
  return `${RECEIPT_BASE_PATH}/${id}`;
}

export function receiptFileId(url: string) {
  const prefix = `${RECEIPT_BASE_PATH}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) || null : null;
}
