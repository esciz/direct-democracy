import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

type DownloadRouteProps = {
  params: Promise<{ documentId: string }>;
};

export async function GET(_request: Request, { params }: DownloadRouteProps) {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") {
    return new NextResponse("Not found", { status: 404 });
  }

  const { documentId } = await params;
  const document = await prisma.civicDocument.findUnique({ where: { id: documentId } });
  if (!document?.localFilePath) {
    return new NextResponse("Document not found", { status: 404 });
  }

  const importRoot = path.join(process.cwd(), "data", "imports", "campaign-finance");
  const absolutePath = path.join(importRoot, path.basename(document.localFilePath));
  if (!absolutePath.startsWith(importRoot)) {
    return new NextResponse("Document not found", { status: 404 });
  }

  const buffer = await fs.readFile(absolutePath).catch(() => null);
  if (!buffer) return new NextResponse("Document not found", { status: 404 });

  return new NextResponse(buffer, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${(document.originalFilename ?? "campaign-finance.pdf").replace(/"/g, "")}"`,
    },
  });
}
