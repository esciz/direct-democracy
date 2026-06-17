#!/usr/bin/env node

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [rawKey, ...rawValue] = arg.replace(/^--/, "").split("=");
    return [rawKey, rawValue.join("=") || "true"];
  }),
);

const baseUrl = args.baseUrl ?? process.env.CIVIC_IMPORT_BASE_URL ?? "http://localhost:3000";
const candidateId = args.candidateId ?? process.env.CANDIDATE_ID;
const limit = args.limit ?? process.env.CANDIDATE_KNOWLEDGE_LIMIT;
const secret = args.secret ?? process.env.CIVIC_IMPORT_SECRET;
const url = new URL("/api/admin/candidate-knowledge/run", baseUrl);

if (candidateId) url.searchParams.set("candidateId", candidateId);
if (limit) url.searchParams.set("limit", limit);

const response = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(secret ? { authorization: `Bearer ${secret}` } : {}),
  },
  body: JSON.stringify({ candidateId, limit }),
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
