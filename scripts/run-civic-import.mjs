#!/usr/bin/env node

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [rawKey, ...rawValue] = arg.replace(/^--/, "").split("=");
    return [rawKey, rawValue.join("=") || "true"];
  }),
);

const baseUrl = args.baseUrl ?? process.env.CIVIC_IMPORT_BASE_URL ?? "http://localhost:3000";
const job = args.job ?? process.env.CIVIC_IMPORT_JOB;
const source = args.source ?? process.env.CIVIC_IMPORT_SOURCE;
const secret = args.secret ?? process.env.CIVIC_IMPORT_SECRET;

if (!job && !source) {
  console.error("Provide --job=<job-key> or --source=<source-slug>.");
  process.exit(1);
}

const url = new URL("/api/admin/civic-import/run", baseUrl);
if (job) url.searchParams.set("job", job);
if (source) url.searchParams.set("source", source);

const response = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(secret ? { authorization: `Bearer ${secret}` } : {}),
  },
  body: JSON.stringify({ job, source }),
});

const text = await response.text();
let payload;

try {
  payload = JSON.parse(text);
} catch {
  payload = text;
}

console.log(JSON.stringify(payload, null, 2));

if (!response.ok) {
  process.exit(1);
}
