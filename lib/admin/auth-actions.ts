"use server";

import { createHash, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_PREVIEW_COOKIE } from "@/lib/admin-preview/context";
import {
  ADMIN_SEED_USER_ID,
  getAdminAuthConfig,
  getAdminSessionCookieOptions,
} from "@/lib/admin/auth";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "@/lib/admin/session-token";
import { MOCK_AUTH_COOKIE } from "@/lib/auth/constants";

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function safeRedirectPath(value: string) {
  if (!value.startsWith("/admin") || value.startsWith("/admin/login")) {
    return "/admin";
  }

  return value;
}

function secureStringEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();

  return timingSafeEqual(leftHash, rightHash);
}

function getMockAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

export async function loginAdminAction(formData: FormData) {
  const config = getAdminAuthConfig();
  const email = readFormValue(formData, "email").trim().toLowerCase();
  const password = readFormValue(formData, "password");
  const nextPath = safeRedirectPath(readFormValue(formData, "next").trim());

  if (!config) {
    return redirect(`/admin/login?error=config&next=${encodeURIComponent(nextPath)}`);
  }

  if (!secureStringEqual(email, config.email) || !secureStringEqual(password, config.password)) {
    return redirect(`/admin/login?error=credentials&next=${encodeURIComponent(nextPath)}`);
  }

  const token = await createAdminSessionToken(config.email, config.sessionSecret);
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE, token, getAdminSessionCookieOptions());
  cookieStore.set(MOCK_AUTH_COOKIE, ADMIN_SEED_USER_ID, getMockAdminCookieOptions());

  redirect(nextPath);
}

export async function logoutAdminAction() {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    ...getAdminSessionCookieOptions(),
    maxAge: 0,
  });
  cookieStore.set(MOCK_AUTH_COOKIE, "", {
    ...getMockAdminCookieOptions(),
    maxAge: 0,
  });
  cookieStore.set(ADMIN_PREVIEW_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: 0,
  });

  redirect("/admin/login?loggedOut=1");
}
