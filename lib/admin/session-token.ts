export const ADMIN_SESSION_COOKIE = "dd_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const ADMIN_SESSION_AUDIENCE = "direct-democracy-admin";
const TOKEN_VERSION = 1;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type AdminSessionPayload = {
  version: number;
  audience: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }

  return difference === 0;
}

async function createSignature(payloadPart: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payloadPart));

  return new Uint8Array(signature);
}

export async function createAdminSessionToken(email: string, secret: string, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const nonce = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(18)));
  const payload: AdminSessionPayload = {
    version: TOKEN_VERSION,
    audience: ADMIN_SESSION_AUDIENCE,
    email: email.trim().toLowerCase(),
    issuedAt,
    expiresAt: issuedAt + ADMIN_SESSION_MAX_AGE_SECONDS,
    nonce,
  };
  const payloadPart = bytesToBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const signaturePart = bytesToBase64Url(await createSignature(payloadPart, secret));

  return `${payloadPart}.${signaturePart}`;
}

export async function verifyAdminSessionToken(token: string | null | undefined, secret: string, now = Date.now()): Promise<AdminSessionPayload | null> {
  if (!token || !secret) {
    return null;
  }

  try {
    const [payloadPart, signaturePart, extraPart] = token.split(".");

    if (!payloadPart || !signaturePart || extraPart) {
      return null;
    }

    const providedSignature = base64UrlToBytes(signaturePart);
    const expectedSignature = await createSignature(payloadPart, secret);

    if (!constantTimeEqual(providedSignature, expectedSignature)) {
      return null;
    }

    const parsed = JSON.parse(textDecoder.decode(base64UrlToBytes(payloadPart))) as Partial<AdminSessionPayload>;
    const nowSeconds = Math.floor(now / 1000);

    if (
      parsed.version !== TOKEN_VERSION ||
      parsed.audience !== ADMIN_SESSION_AUDIENCE ||
      typeof parsed.email !== "string" ||
      !parsed.email ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.nonce !== "string" ||
      parsed.issuedAt > nowSeconds + 300 ||
      parsed.expiresAt <= nowSeconds
    ) {
      return null;
    }

    return parsed as AdminSessionPayload;
  } catch {
    return null;
  }
}
