import "server-only";

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const hex = process.env.API_KEY_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("API_KEY_ENCRYPTION_KEY is not set — required to store/read provider API keys.");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("API_KEY_ENCRYPTION_KEY must be a 64-character hex string (32 bytes) — see .env.example.");
  }
  return key;
}

export function encryptApiKey(plaintext: string): { encryptedKey: string; keyNonce: string } {
  const key = getEncryptionKey();
  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store ciphertext + auth tag together; nonce stored separately per schema.
  return {
    encryptedKey: Buffer.concat([encrypted, authTag]).toString("base64"),
    keyNonce: nonce.toString("base64"),
  };
}

export function decryptApiKey(encryptedKey: string, keyNonce: string): string {
  const key = getEncryptionKey();
  const nonce = Buffer.from(keyNonce, "base64");
  const combined = Buffer.from(encryptedKey, "base64");
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(0, combined.length - 16);
  const decipher = createDecipheriv(ALGORITHM, key, nonce);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Last 4 characters only — for display in the admin UI, never the full key. */
export function maskApiKey(plaintext: string): string {
  if (plaintext.length <= 4) return "****";
  return `${"*".repeat(Math.max(4, plaintext.length - 4))}${plaintext.slice(-4)}`;
}
