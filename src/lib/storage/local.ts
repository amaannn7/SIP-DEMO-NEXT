import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

// Filesystem fallback for src/lib/storage/s3.ts, used automatically when no
// S3_ENDPOINT is configured (see index.ts) — lets attachments/recordings
// work in local dev without Docker/MinIO/a cloud account. Stored under
// .data/ (already gitignored as "local dev volumes"), never under .next or
// src so a build or a source checkout can't wipe or ship uploaded files.
const STORAGE_ROOT = path.join(process.cwd(), ".data", "local-storage");

function resolveKeyPath(key: string): string {
  // A key only ever originates from uploadObject's own randomUUID() below,
  // or a DB column populated by that — never directly from user input — but
  // path.join with an untrusted "../../etc/passwd"-shaped key would still
  // escape STORAGE_ROOT, so this stays a hard boundary rather than trusting
  // that invariant to hold forever as the codebase grows.
  const resolved = path.join(STORAGE_ROOT, key);
  if (!resolved.startsWith(STORAGE_ROOT + path.sep) && resolved !== STORAGE_ROOT) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

// Content-type sidecar, one tiny file per upload — the serving route only
// ever has the raw key (it's a generic file server, shared by chat
// attachments and call recordings), not the DB row the key belongs to, so
// there's nowhere else to recover this from without coupling this route to
// every table that happens to store a storage key.
function contentTypePath(filePath: string): string {
  return `${filePath}.contenttype`;
}

export async function uploadObject(params: { keyPrefix: string; fileName: string; contentType: string; body: Buffer }): Promise<string> {
  const ext = params.fileName.includes(".") ? params.fileName.slice(params.fileName.lastIndexOf(".")) : "";
  const key = `${params.keyPrefix}/${randomUUID()}${ext}`;
  const filePath = resolveKeyPath(key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, params.body);
  await writeFile(contentTypePath(filePath), params.contentType, "utf-8");
  return key;
}

export async function readObject(key: string): Promise<{ body: Buffer; contentType: string }> {
  const filePath = resolveKeyPath(key);
  const [body, contentType] = await Promise.all([
    readFile(filePath),
    readFile(contentTypePath(filePath), "utf-8").catch(() => "application/octet-stream"),
  ]);
  return { body, contentType };
}

/**
 * Real S3 returns a time-limited signed URL; there's no equivalent concept
 * for a route on this same Next.js server, so this just returns the route
 * that streams the file back (see /api/local-storage/[...key]/route.ts) —
 * auth on that route is what actually gates access, not a signature.
 */
export async function getObjectSignedUrl(key: string): Promise<string> {
  return `/api/local-storage/${key}`;
}

export async function deleteObject(key: string): Promise<void> {
  const filePath = resolveKeyPath(key);
  await Promise.all([unlink(filePath).catch(() => {}), unlink(contentTypePath(filePath)).catch(() => {})]);
}
