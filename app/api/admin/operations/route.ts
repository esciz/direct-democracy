import { NextResponse, type NextRequest } from "next/server";

import { requireAdminSession } from "@/lib/admin/permissions";
import { getOperationDefinition, OPERATION_DEFINITIONS, type OperationType } from "@/lib/admin/operations/catalog";
import { createOperationRequest, dispatchAdminOperation } from "@/lib/admin/operations/runner";
import { listAdminOperations } from "@/lib/admin/operations/store";

export async function GET() {
  try {
    await requireAdminSession("dataops.view");
    return NextResponse.json({ ok: true, operations: listAdminOperations(), definitions: OPERATION_DEFINITIONS });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ ok: false, error: status === 401 ? "unauthorized" : "forbidden" }, { status: status === 401 ? 401 : 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminSession("dataops.run");
    const body = (await request.json().catch(() => ({}))) as { operationType?: string; args?: Record<string, unknown> };
    if (!body.operationType || !getOperationDefinition(body.operationType)) {
      return NextResponse.json({ ok: false, error: "Unknown operation." }, { status: 400 });
    }
    const operation = await createOperationRequest({ operationType: body.operationType as OperationType, actor: user, args: body.args ?? {}, triggerType: "admin_run_now" });
    const completed = await dispatchAdminOperation(operation.id);
    return NextResponse.json({ ok: true, operation: completed });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "operation_failed" }, { status: status === 401 ? 401 : status === 403 ? 403 : 400 });
  }
}
