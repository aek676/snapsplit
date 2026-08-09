import { describe, expect, it } from 'bun:test';
import { generateToken, hashToken } from '../service';

describe('generateToken', () => {
  it('returns 32 bytes of entropy encoded as base64url', () => {
    const token = generateToken();

    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(token).toHaveLength(43);
  });

  it('only uses url-safe characters so the token can travel in a link', () => {
    for (const token of Array.from({ length: 100 }, generateToken)) {
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('never repeats a token', () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateToken));

    expect(tokens.size).toBe(1000);
  });
});

describe('hashToken', () => {
  it('matches the canonical SHA-256 vector in lowercase hex', () => {
    // Guards the algorithm and the encoding: any other digest, or a switch to
    // base64/Buffer output, breaks here rather than silently locking everyone
    // out once hashes are already stored.
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('is deterministic across calls', () => {
    // Also pins the hasher's lifetime: a module-level CryptoHasher would keep
    // accumulating input and make the second call disagree with the first.
    const token = generateToken();

    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('maps distinct tokens to distinct hashes', () => {
    const hashes = new Set(
      Array.from({ length: 1000 }, () => hashToken(generateToken())),
    );

    expect(hashes.size).toBe(1000);
  });

  it('does not leak the token it hashes', () => {
    const token = generateToken();

    expect(hashToken(token)).not.toContain(token);
  });
});
