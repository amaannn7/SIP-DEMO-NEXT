import "server-only";

import * as s3Backend from "./s3-backend";
import * as localBackend from "./local";
import * as vercelBlobBackend from "./vercel-blob-backend";

// Three backends, picked once at module load:
//  1. Vercel Blob — BLOB_READ_WRITE_TOKEN present (Vercel sets this itself
//     the moment a Blob store is linked to the project; nothing else to
//     configure). Takes priority since it needs zero external account and
//     is the natural choice on Vercel specifically.
//  2. Real S3/MinIO — S3_ENDPOINT configured with real (non-placeholder)
//     credentials. Not just whether S3_ENDPOINT is present, since
//     .env.example ships a plausible-looking http://localhost:9000 default
//     alongside literal "replace-me" credential placeholders, which a fresh
//     checkout may never fill in if Docker/MinIO isn't running on that
//     machine — treating a still-placeholder access key as "not configured"
//     avoids every upload throwing ECONNREFUSED against a MinIO that was
//     never started.
//  3. Local disk — the dev fallback when neither of the above is set.
const useVercelBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const useS3 = Boolean(process.env.S3_ENDPOINT) && process.env.S3_ACCESS_KEY_ID !== undefined && process.env.S3_ACCESS_KEY_ID !== "replace-me";

const backend = useVercelBlob ? vercelBlobBackend : useS3 ? s3Backend : localBackend;

export const uploadObject: (params: { keyPrefix: string; fileName: string; contentType: string; body: Buffer }) => Promise<string> =
  backend.uploadObject;

export const getObjectSignedUrl: (key: string) => Promise<string> = backend.getObjectSignedUrl;

export const deleteObject: (key: string) => Promise<void> = backend.deleteObject;
