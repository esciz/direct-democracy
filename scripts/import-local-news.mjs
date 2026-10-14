#!/usr/bin/env node

import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [rawKey, ...rawValue] = arg.replace(/^--/, "").split("=");
    return [rawKey, rawValue.join("=") || "true"];
  }),
);

function runImport(source) {
  const provider = source === "carson_now" ? "carson_now" : "local_configured";
  const forwarded = [
    `--provider=${provider}`,
    `--source=${source}`,
    args.limit ? `--limit=${args.limit}` : "--limit=50",
    args.force ? `--force=${args.force}` : null,
    args.dryRun ? `--dryRun=${args.dryRun}` : null,
    args.dailyCap ? `--dailyCap=${args.dailyCap}` : null,
    args.pageSize ? `--pageSize=${args.pageSize}` : null,
  ].filter(Boolean);

  return new Promise((resolve, reject) => {
    const child = spawn("node", ["scripts/import-news-mentions.mjs", ...forwarded], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => {
      if (code && code !== 0) reject(new Error(`${source} import exited with ${code}`));
      else resolve();
    });
  });
}

if (args.all) {
  const prisma = new PrismaClient();
  try {
    const sources = await prisma.newsSource.findMany({
      where: { active: true },
      orderBy: { sourceName: "asc" },
      select: { sourceSlug: true },
    });
    const sourceSlugs = sources.map((source) => source.sourceSlug);
    if (!sourceSlugs.includes("carson_now")) sourceSlugs.unshift("carson_now");
    for (const sourceSlug of sourceSlugs) {
      await runImport(sourceSlug);
    }
  } finally {
    await prisma.$disconnect();
  }
} else {
  await runImport(args.source ?? "carson_now");
}
