import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "crypto";

beforeAll(() => {
  // Generated fresh each run rather than a hand-typed literal — a 64-hex-char
  // string is easy to mistype by a char or two and silently produce a
  // wrong-length key.
  process.env.API_KEY_ENCRYPTION_KEY = randomBytes(32).toString("hex");
});

describe("key-encryption", () => {
  it("round-trips a plaintext key through encrypt/decrypt", async () => {
    const { encryptApiKey, decryptApiKey } = await import("./key-encryption");
    const plaintext = "sk-test-1234567890abcdef";
    const { encryptedKey, keyNonce } = encryptApiKey(plaintext);
    expect(encryptedKey).not.toBe(plaintext);
    const decrypted = decryptApiKey(encryptedKey, keyNonce);
    expect(decrypted).toBe(plaintext);
  });

  it("produces a different ciphertext each time (fresh nonce)", async () => {
    const { encryptApiKey } = await import("./key-encryption");
    const a = encryptApiKey("same-plaintext");
    const b = encryptApiKey("same-plaintext");
    expect(a.encryptedKey).not.toBe(b.encryptedKey);
    expect(a.keyNonce).not.toBe(b.keyNonce);
  });

  it("fails to decrypt with the wrong nonce", async () => {
    const { encryptApiKey, decryptApiKey } = await import("./key-encryption");
    const { encryptedKey } = encryptApiKey("secret");
    const { keyNonce: wrongNonce } = encryptApiKey("different");
    expect(() => decryptApiKey(encryptedKey, wrongNonce)).toThrow();
  });

  it("masks a key to only the last 4 characters", async () => {
    const { maskApiKey } = await import("./key-encryption");
    expect(maskApiKey("sk-1234567890abcd")).toBe("*************abcd");
  });

  it("masks a very short key without going negative on padding", async () => {
    const { maskApiKey } = await import("./key-encryption");
    expect(maskApiKey("ab")).toBe("****");
  });
});
