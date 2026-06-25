import { randomBytes } from "node:crypto";

/**
 * Short, URL-safe, collision-resistant id (base62, 20 chars ≈ 119 bits).
 * Used as primary key for domain tables.
 */
export function createId(): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = randomBytes(20);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
