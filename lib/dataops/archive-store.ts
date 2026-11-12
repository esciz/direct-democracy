import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client, type PutObjectCommandInput } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { get as blobGet, head as blobHead, list as blobList, put as blobPut } from "@vercel/blob";

// Civic evidence only. Profile media and identity storage keep their own adapters.
export function archiveBackend(env: Record<string, string | undefined> = process.env) {
  const value = env.CIVIC_ARCHIVE_BACKEND ?? "vercel_blob";
  if (value !== "vercel_blob" && value !== "r2") throw new Error("invalid_civic_archive_backend");
  return value;
}

export function r2Configuration(env: Record<string, string | undefined> = process.env) {
  for (const key of ["CIVIC_R2_ACCOUNT_ID", "CIVIC_R2_BUCKET", "CIVIC_R2_ACCESS_KEY_ID", "CIVIC_R2_SECRET_ACCESS_KEY"]) {
    if (!env[key]) throw new Error(`missing_civic_archive_setting:${key}`);
  }
  if (!/^[a-f0-9]{32}$/.test(env.CIVIC_R2_ACCOUNT_ID!)) throw new Error("invalid_civic_r2_account");
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(env.CIVIC_R2_BUCKET!)) throw new Error("invalid_civic_r2_bucket");
  return {
    bucket: env.CIVIC_R2_BUCKET!,
    client: {
      region: "auto", endpoint: `https://${env.CIVIC_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.CIVIC_R2_ACCESS_KEY_ID!, secretAccessKey: env.CIVIC_R2_SECRET_ACCESS_KEY! },
      requestChecksumCalculation: "WHEN_REQUIRED" as const, responseChecksumValidation: "WHEN_REQUIRED" as const,
    },
  };
}

let cached: { config: string; client: S3Client; bucket: string } | undefined;
export function r2Store() {
  const config = r2Configuration();
  const signature = JSON.stringify(config);
  if (cached?.config !== signature) {
    cached?.client.destroy();
    cached = { config: signature, client: new S3Client(config.client), bucket: config.bucket };
  }
  return cached!;
}

export function assertArchiveKey(key: string) {
  if (!/^(?:civic-data\/(?:objects\/[a-f0-9]{64}|(?:worker|release)\/(?:latest|[a-f0-9]{64})\.json)|public-meeting-cache\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64})$/.test(key)) throw new Error("invalid_civic_archive_key");
}

export function objectMissing(error: unknown) {
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return value?.$metadata?.httpStatusCode === 404 || value?.name === "NoSuchKey" || value?.name === "NotFound";
}

export async function archiveGet(key: string, options: Parameters<typeof blobGet>[1]) {
  assertArchiveKey(key);
  if (archiveBackend() === "vercel_blob") return blobGet(key, options);
  const { client, bucket } = r2Store();
  try {
    const value = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: options.abortSignal });
    return { statusCode: 200, stream: value.Body?.transformToWebStream() ?? null };
  } catch (error) { if (objectMissing(error)) return null; throw error; }
}

export async function archiveHead(key: string, options?: Parameters<typeof blobHead>[1]) {
  assertArchiveKey(key);
  if (archiveBackend() === "vercel_blob") return blobHead(key, options);
  const { client, bucket } = r2Store();
  try {
    const value = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: options?.abortSignal });
    return { size: value.ContentLength ?? 0 };
  } catch (error) {
    if (objectMissing(error)) throw new Error("Civic archive object not found");
    throw error;
  }
}

export async function archiveList(options: { prefix: string; cursor?: string; limit?: number; abortSignal?: AbortSignal }) {
  if (!["civic-data/objects/", "public-meeting-cache/sha256/"].includes(options.prefix)) throw new Error("invalid_civic_archive_prefix");
  if (archiveBackend() === "vercel_blob") return blobList(options);
  const { client, bucket } = r2Store();
  const value = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: options.prefix, ContinuationToken: options.cursor, MaxKeys: options.limit ?? 1000 }), { abortSignal: options.abortSignal });
  if (value.IsTruncated && !value.NextContinuationToken) throw new Error("r2_pagination_token_missing");
  return { blobs: (value.Contents ?? []).map(row => ({ pathname: row.Key!, size: row.Size ?? 0 })), hasMore: value.IsTruncated ?? false, cursor: value.NextContinuationToken };
}

export async function archivePut(key: string, body: Parameters<typeof blobPut>[1], options: Parameters<typeof blobPut>[2]): Promise<unknown> {
  assertArchiveKey(key);
  if (archiveBackend() === "vercel_blob") { await blobPut(key, body, options); return; }
  const { client, bucket } = r2Store();
  const params: PutObjectCommandInput = {
    Bucket: bucket, Key: key, Body: body as PutObjectCommandInput["Body"], ContentType: options.contentType,
    // Small immutable manifests must never be overwritten. Content-addressed
    // large objects are verified against their hashes by the caller.
    ...(options.allowOverwrite === false ? { IfNoneMatch: "*" } : {}),
  };
  if (!options.multipart) { await client.send(new PutObjectCommand(params), { abortSignal: options.abortSignal }); return; }
  const upload = new Upload({ client, params, queueSize: 2, partSize: 8 * 1024 * 1024, leavePartsOnError: false });
  const abort = () => { void upload.abort(); };
  options.abortSignal?.throwIfAborted();
  options.abortSignal?.addEventListener("abort", abort, { once: true });
  try { await upload.done(); } finally { options.abortSignal?.removeEventListener("abort", abort); }
}
