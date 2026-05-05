import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth-session";
import { recordContactAction } from "@/lib/contact/store";
import type { ContactActionTargetType, ContactMethod } from "@/types/domain";

function isContactMethod(value: unknown): value is ContactMethod {
  return value === "email" || value === "phone" || value === "form";
}

function isContactActionTargetType(value: unknown): value is ContactActionTargetType {
  return value === "issue" || value === "petition" || value === "legislation";
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  try {
    const payload = await request.json();

    if (
      typeof payload?.entityId !== "string" ||
      typeof payload?.officialId !== "string" ||
      !isContactActionTargetType(payload?.entityType) ||
      !isContactMethod(payload?.method)
    ) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await recordContactAction({
      userId: currentUser.id,
      userName: currentUser.name,
      entityId: payload.entityId,
      entityType: payload.entityType,
      officialId: payload.officialId,
      method: payload.method,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
