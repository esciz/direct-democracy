import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/admin/permissions";
import { getSanitizedOperationLog } from "@/lib/admin/operations/runner";
import { getAdminOperation } from "@/lib/admin/operations/store";

type RouteContext = {
  params: Promise<{ operationId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireAdminSession("dataops.view");
    const { operationId } = await context.params;
    const operation = getAdminOperation(operationId);
    if (!operation) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const url = new URL(request.url);
    const includeLogs = url.searchParams.get("logs") === "1";
    return NextResponse.json({
      ok: true,
      operation,
      logs: includeLogs
        ? {
            stdout: getSanitizedOperationLog(operationId, "stdout"),
            stderr: getSanitizedOperationLog(operationId, "stderr"),
          }
        : null,
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ ok: false, error: status === 401 ? "unauthorized" : "forbidden" }, { status: status === 401 ? 401 : 403 });
  }
}
