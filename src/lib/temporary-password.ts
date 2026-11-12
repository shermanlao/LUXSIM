import { randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Cryptographically random temporary password. Callers must not log the return value. */
export function generateTemporaryPassword(length = 16): string {
  const size = Math.max(12, length);
  const bytes = randomBytes(size);
  let out = "";
  for (let i = 0; i < size; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}
