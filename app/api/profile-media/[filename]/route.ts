import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LOCAL_MEDIA_ROOT = path.join(process.cwd(), ".local", "profile-media");
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

type ProfileMediaRouteProps = {
  params: Promise<{ filename: string }>;
};

export async function GET(_request: Request, { params }: ProfileMediaRouteProps) {
  const { filename } = await params;

  if (!/^[a-z0-9_-]+\.(?:jpg|png|webp)$/i.test(filename)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const buffer = await fs.readFile(path.join(LOCAL_MEDIA_ROOT, filename)).catch(() => null);

  if (!buffer || !CONTENT_TYPES[extension]) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(buffer, {
    headers: {
      "content-type": CONTENT_TYPES[extension],
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
