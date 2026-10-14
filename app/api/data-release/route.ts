import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const release = JSON.parse(await readFile(path.join(process.cwd(), "data/generated/civic-data-release.json"), "utf8"));
    if (!/^[a-f0-9]{64}$/.test(release.id ?? "") || !Number.isFinite(Date.parse(release.createdAt)) || !release.metrics || typeof release.coverageComplete !== "boolean") throw new Error("invalid_packaged_release");
    return Response.json({ id: release.id, createdAt: release.createdAt, sourceCommit: release.sourceCommit, metrics: release.metrics, coverageComplete: release.coverageComplete === true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ id: null, status: "packaged_data_release_unverified", coverageComplete: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
