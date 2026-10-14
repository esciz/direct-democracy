#!/usr/bin/env node

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [rawKey, ...rawValue] = arg.replace(/^--/, "").split("=");
    return [rawKey, rawValue.join("=") || "true"];
  }),
);

const baseUrl = args.baseUrl ?? process.env.CIVIC_IMPORT_BASE_URL ?? "http://localhost:3000";
const secret = args.secret ?? process.env.CIVIC_IMPORT_SECRET;
const url = new URL("/api/admin/issue-positions/generate-vote-questions", baseUrl);

const response = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(secret ? { authorization: `Bearer ${secret}` } : {}),
  },
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
