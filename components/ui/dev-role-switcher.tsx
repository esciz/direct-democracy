"use client";

import { usePathname } from "next/navigation";

import { switchDevUser } from "@/lib/auth/actions";
import { DEV_ONLY_AUTH_ENABLED, NEW_USER_DEMO_ID, PUBLIC_SESSION_VALUE } from "@/lib/auth/constants";
import { getRoleLabel } from "@/lib/auth/roles";
import type { AuthUser } from "@/types/domain";

type DevRoleSwitcherProps = {
  currentUserId: string | null;
  users: AuthUser[];
};

export function DevRoleSwitcher({ currentUserId, users }: DevRoleSwitcherProps) {
  const pathname = usePathname();

  if (!DEV_ONLY_AUTH_ENABLED) {
    return null;
  }

  return (
    <form action={switchDevUser} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="redirectTo" value={pathname} />
      <label htmlFor="userId" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Demo profile
      </label>
      <select
        id="userId"
        name="userId"
        defaultValue={currentUserId ?? PUBLIC_SESSION_VALUE}
        className="min-w-0 max-w-full rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-civic-500 md:min-w-[16rem]"
      >
        <option value={PUBLIC_SESSION_VALUE}>Logged out / public landing</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} · {user.id === NEW_USER_DEMO_ID ? "New unverified user" : getRoleLabel(user.role)}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-full border border-civic-200 bg-civic-50 px-3 py-2 text-sm font-semibold text-civic-700 transition hover:border-civic-500"
      >
        Switch
      </button>
    </form>
  );
}
