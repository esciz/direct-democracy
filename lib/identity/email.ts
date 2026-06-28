import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getDurableIdentityStorageStatus } from "@/lib/identity/durable-storage";
import { prisma } from "@/lib/prisma";

export type EmailPurpose =
  | "account_email_verification"
  | "password_reset"
  | "password_changed"
  | "suspicious_login"
  | "mfa_disabled"
  | "email_change_confirmation"
  | "verification_review_status";

export type EmailProviderStatus = "development_adapter" | "production_provider_configured" | "email_provider_unconfigured";
export type EmailDeliveryStatus = "sent" | "queued_development" | "provider_unconfigured" | "provider_send_failed";

const PRIVATE_EMAIL_DIR = path.join(process.cwd(), "data", "private", "email");
const PRIVATE_OUTBOX_PATH = path.join(PRIVATE_EMAIL_DIR, "development-outbox.json");

export function getEmailProviderStatus() {
  const provider = process.env.DIRECT_DEMOCRACY_EMAIL_PROVIDER;
  const sender = process.env.DIRECT_DEMOCRACY_EMAIL_FROM;
  const apiKey = process.env.DIRECT_DEMOCRACY_EMAIL_API_KEY;
  if (provider && sender && apiKey) return "production_provider_configured" as const;
  if (process.env.NODE_ENV !== "production") return "development_adapter" as const;
  return "email_provider_unconfigured" as const;
}

export function createOneTimeEmailToken(purpose: EmailPurpose, ttlMinutes = 30) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return {
    token,
    tokenHash,
    purpose,
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString(),
    oneTimeUse: true,
  };
}

export async function createDurableEmailToken(input: {
  accountId: string;
  purpose: EmailPurpose;
  ttlMinutes?: number;
  metadata?: Record<string, unknown>;
}) {
  const token = createOneTimeEmailToken(input.purpose, input.ttlMinutes ?? 30);
  const storage = await getDurableIdentityStorageStatus();
  if (!storage.ready) {
    return {
      ok: false as const,
      status: storage.status,
      token: token.token,
      tokenHashPersisted: false,
      expiresAt: token.expiresAt,
    };
  }

  await prisma.$executeRawUnsafe(
    `insert into "IdentityToken" ("id","accountId","tokenType","tokenHash","purpose","expiresAt","metadata")
     values ($1,$2,'email',$3,$4,$5::timestamptz,$6::jsonb)`,
    `token_${Date.now()}_${createHash("sha256").update(token.tokenHash).digest("hex").slice(0, 10)}`,
    input.accountId,
    token.tokenHash,
    input.purpose,
    token.expiresAt,
    JSON.stringify({ ...(input.metadata ?? {}), oneTimeUse: true }),
  );

  return {
    ok: true as const,
    status: "token_persisted",
    token: token.token,
    tokenHashPersisted: true,
    expiresAt: token.expiresAt,
  };
}

export async function consumeDurableEmailToken(token: string, purpose: EmailPurpose) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const storage = await getDurableIdentityStorageStatus();
  if (!storage.ready) return { ok: false as const, status: storage.status };
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `update "IdentityToken"
     set "consumedAt"=now()
     where "tokenHash"=$1
       and "purpose"=$2
       and "consumedAt" is null
       and "revokedAt" is null
       and "expiresAt" > now()
     returning "id"`,
    tokenHash,
    purpose,
  );
  return { ok: rows.length === 1, status: rows.length === 1 ? "token_consumed" as const : "token_invalid_or_expired" as const };
}

export async function recentEmailTokenCount(accountId: string, purpose: EmailPurpose, windowMinutes = 30) {
  const storage = await getDurableIdentityStorageStatus();
  if (!storage.ready) return { ok: false as const, status: storage.status, count: null };
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `select count(*)::bigint as count from "IdentityToken"
     where "accountId"=$1 and "purpose"=$2 and "createdAt" > now() - ($3 || ' minutes')::interval`,
    accountId,
    purpose,
    String(windowMinutes),
  );
  return { ok: true as const, status: "counted", count: Number(rows[0]?.count ?? 0) };
}

function readDevelopmentOutbox() {
  if (!existsSync(PRIVATE_OUTBOX_PATH)) return [];
  return JSON.parse(readFileSync(PRIVATE_OUTBOX_PATH, "utf8")) as Array<Record<string, unknown>>;
}

function appendDevelopmentOutbox(message: Record<string, unknown>) {
  mkdirSync(PRIVATE_EMAIL_DIR, { recursive: true, mode: 0o700 });
  const outbox = readDevelopmentOutbox();
  outbox.unshift(message);
  writeFileSync(PRIVATE_OUTBOX_PATH, `${JSON.stringify(outbox.slice(0, 100), null, 2)}\n`, { mode: 0o600 });
}

function sanitizeProviderReason(value: string) {
  return value
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(/"api[_-]?key"\s*:\s*"[^"]+"/gi, '"apiKey":"[redacted]"')
    .replace(/"authorization"\s*:\s*"[^"]+"/gi, '"authorization":"[redacted]"')
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export async function sendIdentityEmail(input: {
  to: string;
  purpose: EmailPurpose;
  subject: string;
  text: string;
  html?: string;
}) {
  const status = getEmailProviderStatus();
  if (status === "email_provider_unconfigured") {
    return { ok: false as const, status: "provider_unconfigured" as EmailDeliveryStatus, providerStatus: status };
  }

  if (status === "development_adapter") {
    appendDevelopmentOutbox({
      createdAt: new Date().toISOString(),
      to: redactEmailForAudit(input.to),
      purpose: input.purpose,
      subject: input.subject,
      tokenIncludedInGeneratedArtifacts: false,
      note: "Development adapter records metadata only. Secrets and one-time tokens must stay out of generated artifacts.",
    });
    return { ok: true as const, status: "queued_development" as EmailDeliveryStatus, providerStatus: status };
  }

  const provider = process.env.DIRECT_DEMOCRACY_EMAIL_PROVIDER?.toLowerCase();
  if (provider !== "resend") {
    return { ok: false as const, status: "provider_send_failed" as EmailDeliveryStatus, providerStatus: status, reason: "unsupported_provider_adapter" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DIRECT_DEMOCRACY_EMAIL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.DIRECT_DEMOCRACY_EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });
    if (!response.ok) {
      const body = sanitizeProviderReason(await response.text().catch(() => ""));
      const reason = body ? `provider_http_${response.status}:${body}` : `provider_http_${response.status}`;
      return { ok: false as const, status: "provider_send_failed" as EmailDeliveryStatus, providerStatus: status, reason };
    }
    return { ok: true as const, status: "sent" as EmailDeliveryStatus, providerStatus: status };
  } catch (error) {
    const reason = error instanceof Error ? sanitizeProviderReason(error.message) : "unknown_error";
    return { ok: false as const, status: "provider_send_failed" as EmailDeliveryStatus, providerStatus: status, reason };
  }
}

export function redactEmailForAudit(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "invalid-email";
  return `${name.slice(0, 2)}***@${domain}`;
}

export function getEmailConfigurationRequirements() {
  return [
    "DIRECT_DEMOCRACY_EMAIL_PROVIDER",
    "DIRECT_DEMOCRACY_EMAIL_FROM",
    "DIRECT_DEMOCRACY_EMAIL_API_KEY",
  ];
}
