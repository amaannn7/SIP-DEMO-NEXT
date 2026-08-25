import "server-only";

import * as s3Backend from "./s3-backend";
import * as localBackend from "./local";

// Picks the storage backend once, at module load, based on whether S3/MinIO
// is actually configured with real credentials — not just whether
// S3_ENDPOINT is present, since .env.example ships a plausible-looking
// http://localhost:9000 default alongside literal "replace-me" credential
// placeholders, which a fresh checkout may never fill in if Docker/MinIO
// isn't running on that machine. Treating an unset OR still-placeholder
// access key as "S3 not configured" avoids every upload throwing
// ECONNREFUSED against a MinIO that was never actually started; setting
// real credentials (real S3, R2, B2, or a running MinIO) switches back to
// the s3-backend with no code changes on either side of this file.
const useS3 = Boolean(process.env.S3_ENDPOINT) && process.env.S3_ACCESS_KEY_ID !== undefined && process.env.S3_ACCESS_KEY_ID !== "replace-me";

export const uploadObject: (params: { keyPrefix: string; fileName: string; contentType: string; body: Buffer }) => Promise<string> = useS3
  ? s3Backend.uploadObject
  : localBackend.uploadObject;

export const getObjectSignedUrl: (key: string) => Promise<string> = useS3 ? s3Backend.getObjectSignedUrl : localBackend.getObjectSignedUrl;

export const deleteObject: (key: string) => Promise<void> = useS3 ? s3Backend.deleteObject : localBackend.deleteObject;
