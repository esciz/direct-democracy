import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { accountRecovery } from "@/lib/identity/account-recovery";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  let verified = false;
  try {
    verified = (await accountRecovery.consume({ token, purpose: "account_email_verification" })).ok;
  } catch { /* Storage failure leaves the token and verification status unchanged. */ }
  redirect(`/account/verification?status=${verified ? "email-verified" : "email-invalid"}#email-verification`);
}
