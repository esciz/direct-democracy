import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

export default async function AdminCaseImportPage() {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") redirect("/profile");

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Import public civic cases"
        description="Stage CSV or JSON case-like records for validation, redaction, field mapping, and review before any public visibility."
        actions={<Link href="/admin/cases" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">Review queue</Link>}
      />

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Required fields</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            "title",
            "plain_language_summary",
            "jurisdiction",
            "civic_layer",
            "source_type",
            "source_url or source_snippet",
            "policy_area",
            "review_status",
          ].map((field) => (
            <div key={field} className="rounded-2xl border border-white/10 bg-black/15 p-3 text-sm font-semibold text-slate-200">{field}</div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Import execution is intentionally review-gated. Files should be validated for field mapping and private information redaction before records are written to `data/generated/public-civic-cases.json`.
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-amber-300/20 bg-amber-300/10 p-5 text-sm leading-6 text-amber-50">
        Public display stays off until a case is reviewed. Do not include private complainant names, home addresses, phone numbers, or emails unless the record is clearly an official public/business/entity context.
      </section>
    </div>
  );
}
