import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { del, put } from "@vercel/blob";

const MAX_PROFILE_MEDIA_BYTES = 5 * 1024 * 1024;
const LOCAL_MEDIA_ROOT = path.join(process.cwd(), ".local", "profile-media");

type ProfileMediaKind = "profile" | "banner";
type ProfileMediaErrorCode = "media-format" | "media-size" | "media-storage";

type ValidatedProfileMedia = {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

export class ProfileMediaUploadError extends Error {
  code: ProfileMediaErrorCode;

  constructor(code: ProfileMediaErrorCode, message: string) {
    super(message);
    this.name = "ProfileMediaUploadError";
    this.code = code;
  }
}

function detectImageType(buffer: Buffer): Pick<ValidatedProfileMedia, "contentType" | "extension"> | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { contentType: "image/png", extension: "png" };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }

  return null;
}

export function profileMediaBlobStorageIsConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID),
  );
}

function safeUserKey(userId: string) {
  return userId.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 48) || "user";
}

export async function validateProfileMediaUpload(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  if (value.size > MAX_PROFILE_MEDIA_BYTES) {
    throw new ProfileMediaUploadError("media-size", "Profile images must be 5 MB or smaller.");
  }

  const buffer = Buffer.from(await value.arrayBuffer());
  const detected = detectImageType(buffer);

  if (!detected) {
    throw new ProfileMediaUploadError("media-format", "Use a JPEG, PNG, or WebP image.");
  }

  return { buffer, ...detected } satisfies ValidatedProfileMedia;
}

export async function storeProfileMedia(
  userId: string,
  kind: ProfileMediaKind,
  media: ValidatedProfileMedia,
) {
  const filename = `${safeUserKey(userId)}-${kind}-${randomUUID()}.${media.extension}`;

  if (profileMediaBlobStorageIsConfigured()) {
    await put(`profile-media/${filename}`, media.buffer, {
      access: "private",
      contentType: media.contentType,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      maximumSizeInBytes: MAX_PROFILE_MEDIA_BYTES,
    });

    return `/api/profile-media/${filename}`;
  }

  if (process.env.VERCEL_ENV) {
    throw new ProfileMediaUploadError(
      "media-storage",
      "Profile media storage is not configured for this deployment.",
    );
  }

  await fs.mkdir(LOCAL_MEDIA_ROOT, { recursive: true });
  await fs.writeFile(path.join(LOCAL_MEDIA_ROOT, filename), media.buffer, { flag: "wx" });
  return `/api/profile-media/${filename}`;
}

export async function deleteProfileMedia(mediaUrl: string) {
  if (!mediaUrl) return;

  if (mediaUrl.startsWith("/api/profile-media/")) {
    const filename = path.basename(mediaUrl);

    if (/^[a-z0-9_-]+\.(?:jpg|png|webp)$/i.test(filename)) {
      if (profileMediaBlobStorageIsConfigured()) {
        await del(`profile-media/${filename}`).catch(() => undefined);
      } else {
        await fs.unlink(path.join(LOCAL_MEDIA_ROOT, filename)).catch(() => undefined);
      }
    }

    return;
  }

  if (!profileMediaBlobStorageIsConfigured()) return;

  try {
    const url = new URL(mediaUrl);
    if (url.hostname.endsWith(".blob.vercel-storage.com")) {
      await del(mediaUrl);
    }
  } catch {
    // Ignore external and malformed URLs; this helper only removes app-owned media.
  }
}
