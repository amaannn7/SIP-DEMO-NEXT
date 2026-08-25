import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const BUCKET = process.env.S3_BUCKET ?? "sales-intel-uploads";

function client(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    // MinIO is path-style (http://host/bucket/key); real S3 uses virtual-hosted-style by default.
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
}

// A fresh deployment's MinIO has no buckets yet, and nothing in docker-compose
// provisions one — so the first upload creates it on demand rather than
// requiring an extra manual `mc mb` step in the deploy checklist. Cached per
// process so this check only runs once, not on every upload.
let bucketReadyPromise: Promise<void> | null = null;
async function ensureBucket(s3: S3Client): Promise<void> {
  bucketReadyPromise ??= (async () => {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    }
  })();
  return bucketReadyPromise;
}

export async function uploadObject(params: { keyPrefix: string; fileName: string; contentType: string; body: Buffer }): Promise<string> {
  const ext = params.fileName.includes(".") ? params.fileName.slice(params.fileName.lastIndexOf(".")) : "";
  const key = `${params.keyPrefix}/${randomUUID()}${ext}`;
  const s3 = client();
  await ensureBucket(s3);
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: params.body, ContentType: params.contentType }));
  return key;
}

export async function getObjectSignedUrl(key: string): Promise<string> {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 3600 });
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
