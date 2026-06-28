import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { verifyAccountEmailToken } from "@/lib/identity/accounts";

export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    redirect("/account/verification?status=email-invalid#email-verification");
  }

  const result = verifyAccountEmailToken(token);
  if (!result.ok) {
    redirect(`/account/verification?status=${result.reason === "token_expired" ? "email-expired" : "email-invalid"}#email-verification`);
  }

  redirect("/account/verification?status=email-verified#email-verification");
}
