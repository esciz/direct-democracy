import { NextResponse } from "next/server";

import { NewsMentionProviderName, NewsMentionTargetType } from "@prisma/client";

import { importNewsMentions } from "@/lib/news-mentions/store";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request, url: URL) {
  const secret = process.env.CIVIC_IMPORT_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;

  return bearerToken === secret || url.searchParams.get("secret") === secret;
}

async function run(request: Request) {
  const url = new URL(request.url);

  if (!isAuthorized(request, url)) {
    return NextResponse.json({ ok: false, error: "Unauthorized news mention import request." }, { status: 401 });
  }

  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const limit = Number(body.limit ?? url.searchParams.get("limit") ?? 10);
  const dailyCap = Number(body.dailyCap ?? url.searchParams.get("dailyCap") ?? 100);
  const pageSize = Number(body.pageSize ?? url.searchParams.get("pageSize") ?? 5);
  const targetTypeValue = body.targetType ?? url.searchParams.get("targetType");
  const targetIdValue = body.targetId ?? url.searchParams.get("targetId");
  const providerValue = body.provider ?? url.searchParams.get("provider");
  const sourceSlug = body.source ?? body.sourceSlug ?? url.searchParams.get("source") ?? url.searchParams.get("sourceSlug") ?? undefined;
  const dryRunValue = body.dryRun ?? url.searchParams.get("dryRun");
  const dryRun = dryRunValue === true || dryRunValue === "true";
  const forceValue = body.force ?? url.searchParams.get("force");
  const force = forceValue === true || forceValue === "true";
  const targetType =
    targetTypeValue === NewsMentionTargetType.CANDIDATE || targetTypeValue === NewsMentionTargetType.OFFICIAL
      ? targetTypeValue
      : undefined;
  const targetId = typeof targetIdValue === "string" && targetIdValue.trim() ? targetIdValue.trim() : undefined;
  const providerName =
    typeof providerValue === "string" && providerValue.toUpperCase() in NewsMentionProviderName
      ? (providerValue.toUpperCase() as NewsMentionProviderName)
      : providerValue === "carson_now"
        ? NewsMentionProviderName.CARSON_NOW
        : providerValue === "local_configured"
          ? NewsMentionProviderName.LOCAL_CONFIGURED
          : undefined;

  try {
    const result = await importNewsMentions({
      providerName,
      sourceSlug: typeof sourceSlug === "string" ? sourceSlug : undefined,
      limit: Number.isFinite(limit) ? Math.max(0, Math.min(limit, 25)) : 10,
      dailyCap: Number.isFinite(dailyCap) ? Math.max(0, Math.min(dailyCap, 100)) : 100,
      pageSize: Number.isFinite(pageSize) ? Math.max(1, Math.min(pageSize, 20)) : 5,
      dryRun,
      force,
      targetType,
      targetId,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown news mention import error.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
