export function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

export function hashToken(token: string) {
  return new Bun.CryptoHasher('sha256').update(token).digest('hex');
}
