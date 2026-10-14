import { appendFileSync } from "node:fs";

const allowed = new Set([
  "DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "FEC_API_KEY", "CIVIC_DATA_DEPLOY_HOOK",
  "IDENTITY_MFA_ENCRYPTION_KEY", "IDENTITY_MFA_KEY_VERSION", "IDENTITY_EVIDENCE_STORAGE_BUCKET",
  "IDENTITY_EVIDENCE_ENCRYPTION_KEY", "IDENTITY_EVIDENCE_KEY_VERSION",
  "PLAYWRIGHT_SESSION_STORAGE_BUCKET", "PLAYWRIGHT_SESSION_STORAGE_KEY", "PLAYWRIGHT_SESSION_KEY_VERSION",
  "DIRECT_DEMOCRACY_EMAIL_PROVIDER", "DIRECT_DEMOCRACY_EMAIL_FROM", "DIRECT_DEMOCRACY_EMAIL_API_KEY",
  "DIRECT_DEMOCRACY_EMAIL_SECRET_VERSION", "DIRECT_DEMOCRACY_PUBLIC_DOMAIN", "DIRECT_DEMOCRACY_PUBLIC_URL",
]);
if (!process.env.GITHUB_ACTIONS || !process.env.GITHUB_ENV) throw new Error("github_worker_environment_required");
if (!process.env.CIVIC_WORKER_ENV) {
  if (process.argv.includes("--required")) throw new Error("CIVIC_WORKER_ENV repository secret is missing");
  console.log("No civic worker bundle; using individually configured workflow secrets.");
} else {
  const entries = Object.entries(JSON.parse(process.env.CIVIC_WORKER_ENV));
  for (const [key, value] of entries) {
    if (!allowed.has(key) || typeof value !== "string" || !value || /[\r\n\0]/.test(value)) throw new Error("invalid_civic_worker_configuration");
  }
  for (const [key, value] of entries) {
    // GitHub consumes this command to mask individual credentials in every
    // subsequent child-process log; the JSON bundle alone would not mask them.
    console.log(`::add-mask::${value.replaceAll("%", "%25")}`);
    appendFileSync(process.env.GITHUB_ENV, `${key}=${value}\n`);
  }
  console.log(`Loaded ${entries.length} allowlisted worker settings.`);
}
