import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  verifyAdminSessionToken,
  type AdminSessionPayload,
} from "@/lib/admin/session-token";

export const ADMIN_SEED_USER_ID = "user_admin_riley_morgan";

export type AdminAuthConfig = {
  email: string;
  password: string;
  sessionSecret: string;
};

export function getAdminAuthConfigurationIssues() {
  const issues: string[] = [];
  const email = process.env.ADMIN_EMAIL?.trim() ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  const sessionSecret = process.env.ADMIN_SESSION_SECRET ?? "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    issues.push("ADMIN_EMAIL must be a valid email address.");
  }

  if (password.length < 12) {
    issues.push("ADMIN_PASSWORD must be at least 12 characters.");
  }

  if (sessionSecret.length < 32) {
    issues.push("ADMIN_SESSION_SECRET must be at least 32 characters.");
  }

  return issues;
}

export function getAdminAuthConfig(): AdminAuthConfig | null {
  if (getAdminAuthConfigurationIssues().length > 0) {
    return null;
  }

  return {
    email: process.env.ADMIN_EMAIL!.trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD!,
    sessionSecret: process.env.ADMIN_SESSION_SECRET!,
  };
}

export function getAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  };
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const config = getAdminAuthConfig();

  if (!config) {
    return null;
  }

  const cookieStore = await cookies();
  const session = await verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value, config.sessionSecret);

  if (!session || session.email !== config.email) {
    return null;
  }

  return session;
}

export async function requireAdminSession(nextPath = "/admin"): Promise<AdminSessionPayload> {
  const session = await getAdminSession();

  if (!session) {
    const params = new URLSearchParams({ next: nextPath.startsWith("/admin") ? nextPath : "/admin" });
    return redirect(`/admin/login?${params.toString()}`);
  }

  return session;
}
