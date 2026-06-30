import { MOCK_AUTH_COOKIE } from "@/lib/auth/constants";
import { MFA_SESSION_COOKIE } from "@/lib/identity/mfa-session";

type AuthCookieOptions = {
  httpOnly?: boolean;
  sameSite?: "lax";
  path: string;
  secure?: boolean;
  domain?: string;
  expires?: Date;
  maxAge?: number;
};

type MutableCookieStore = {
  set(name: string, value: string, options: AuthCookieOptions): unknown;
  delete(name: string): unknown;
};

function getHostnameFromUrl(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

export function getSessionCookieDomain() {
  const configuredDomain =
    process.env.DIRECT_DEMOCRACY_PUBLIC_DOMAIN?.trim() ||
    getHostnameFromUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    getHostnameFromUrl(process.env.DIRECT_DEMOCRACY_PUBLIC_URL);

  if (!configuredDomain || process.env.NODE_ENV !== "production") return undefined;

  const domain = configuredDomain.toLowerCase().replace(/^www\./, "");
  const isLocal = domain === "localhost" || domain.endsWith(".localhost") || /^[\d.]+$/.test(domain);
  const isVercelPreview = domain === "vercel.app" || domain.endsWith(".vercel.app");

  if (isLocal || isVercelPreview) return undefined;

  return `.${domain}`;
}

export function getAuthCookieOptions(): AuthCookieOptions {
  const domain = getSessionCookieDomain();

  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    ...(domain ? { domain } : {}),
  };
}

export function getAuthCookieDeleteOptions(): AuthCookieOptions {
  const domain = getSessionCookieDomain();

  return {
    path: "/",
    ...(domain ? { domain } : {}),
  };
}

export function clearAuthSessionCookies(cookieStore: MutableCookieStore) {
  cookieStore.delete(MOCK_AUTH_COOKIE);
  cookieStore.delete(MFA_SESSION_COOKIE);

  const deleteOptions = getAuthCookieDeleteOptions();
  if (!deleteOptions.domain) return;

  const expired = {
    ...deleteOptions,
    expires: new Date(0),
    maxAge: 0,
  };

  cookieStore.set(MOCK_AUTH_COOKIE, "", expired);
  cookieStore.set(MFA_SESSION_COOKIE, "", expired);
}
