import { NextResponse } from "next/server";

import { runCandidateKnowledgeEnrichment } from "@/lib/enrichment/candidate-knowledge";
import { prisma } from "@/lib/prisma";

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
    return NextResponse.json({ ok: false, error: "Unauthorized candidate knowledge enrichment request." }, { status: 401 });
  }

  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const candidateId = String(body.candidateId ?? url.searchParams.get("candidateId") ?? "");
  const limit = Number(body.limit ?? url.searchParams.get("limit") ?? 10);

  try {
    const candidateIds = candidateId
      ? [candidateId]
      : (
          await prisma.candidate.findMany({
            where: { sourceId: { not: null } },
            orderBy: { updatedAt: "desc" },
            take: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 25)) : 10,
            select: { id: true },
          })
        ).map((candidate) => candidate.id);

    const results = [];
    for (const id of candidateIds) {
      const rows = await runCandidateKnowledgeEnrichment({ candidateId: id });
      results.push({ candidateId: id, rows: rows.length });
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown candidate knowledge enrichment error.",
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
