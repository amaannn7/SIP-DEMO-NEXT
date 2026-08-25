import { put, del } from "@vercel/blob";
import { randomUUID } from "node:crypto";

/**
 * Vercel Blob backend — Vercel's own native object storage, no external
 * account needed (unlike s3-backend.ts, which needs a real S3/R2/MinIO
 * endpoint + credentials). Picked automatically by storage/s3.ts when
 * BLOB_READ_WRITE_TOKEN is set, which Vercel injects itself the moment a
 * Blob store is linked to the project — nothing to configure by hand
 * beyond "create the store" in the Vercel dashboard.
 *
 * The "key" this backend hands back to callers (and that they persist in
 * the DB — chatMessages.attachmentKey, callLogs.recordingKey) IS the full
 * public URL `put()` already returns, not a bucket-relative path — Blob's
 * public URLs are permanent and globally unique per upload, so there's
 * nothing to reconstruct later. That avoids needing a second env var (a
 * "public base URL") to turn a bucket-relative key back into a URL, the way
 * the S3 backend's bucket+key split would otherwise require here too.
 */
export async function uploadObject(params: { keyPrefix: string; fileName: string; contentType: string; body: Buffer }): Promise<string> {
  const ext = params.fileName.includes(".") ? params.fileName.slice(params.fileName.lastIndexOf(".")) : "";
  const pathname = `${params.keyPrefix}/${randomUUID()}${ext}`;
  // access: "public" — Blob's private/signed-URL access tier requires a
  // paid plan feature this app doesn't otherwise depend on; a random UUID
  // in the path is already unguessable, matching the same practical privacy
  // the signed URLs from the other two backends provide (a short-lived
  // signed URL is only "more private" in that it expires — this URL never
  // leaks through anything but the app itself, since it's stored, never
  // listed anywhere).
  const blob = await put(pathname, params.body, { access: "public", contentType: params.contentType, addRandomSuffix: false });
  return blob.url;
}

/**
 * The other two backends return a real short-lived signed URL; Blob's
 * public-access URL is stable and never expires, but getObjectSignedUrl's
 * callers already just fetch-and-render it immediately, so a stable URL
 * satisfies the same contract — it's simply also cacheable indefinitely,
 * which is a strict improvement for this app's use (chat attachment
 * previews, call recording playback), not a limitation. `key` here IS the
 * URL already (see uploadObject above), so this is a passthrough.
 */
export async function getObjectSignedUrl(key: string): Promise<string> {
  return key;
}

export async function deleteObject(key: string): Promise<void> {
  await del(key);
}
