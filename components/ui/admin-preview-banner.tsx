import Link from "next/link";

import { getActivePreviewContext, getPreviewDataStateLabel, getPreviewRoleLabel } from "@/lib/admin-preview/context";

function formatJurisdiction(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function AdminPreviewBanner() {
  const context = await getActivePreviewContext();

  if (!context) {
    return null;
  }

  return (
    <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">
          Preview mode: {getPreviewRoleLabel(context.role)} - {formatJurisdiction(context.jurisdiction)} - {getPreviewDataStateLabel(context.dataState)}
        </p>
        <Link href="/admin/preview" className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100 hover:text-white">
          Admin preview
        </Link>
      </div>
    </div>
  );
}
