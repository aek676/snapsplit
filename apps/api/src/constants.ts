export * from './storage/receipt-storage';

/**
 * Mongo ObjectId as it travels in a URL: 24 lowercase hex chars, the canonical
 * form `toHexString()` produces. Shared with the web client so both ends agree
 * on what can name a session.
 */
export const OBJECT_ID_PATTERN = '^[a-f\\d]{24}$';
