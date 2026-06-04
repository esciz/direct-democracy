import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { getAdminOfficials } from "@/lib/civic-data/service";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

export default async function AdminOfficialsPage() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const officials = await getAdminOfficials();

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Officials"
        description="Review normalized officeholder records imported from Nevada beta civic sources."
        actions={
          <Link href="/admin/data" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
            Dashboard
          </Link>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="grid gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 md:grid-cols-[1fr_1fr_0.8fr_0.6fr_0.7fr]">
          <span>Name</span>
          <span>Office</span>
          <span>Jurisdiction</span>
          <span>Status</span>
          <span>Updated</span>
        </div>
        <div className="divide-y divide-white/10">
          {officials.length > 0 ? (
            officials.map((official) => (
              <article key={official.id} className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1fr_1fr_0.8fr_0.6fr_0.7fr]">
                <div>
                  <p className="font-semibold text-slate-50">{official.fullName}</p>
                  <p className="mt-1 text-xs text-slate-400">{official.partyText ?? "No party recorded"}</p>
                </div>
                <p className="text-slate-300">{official.officeTitle}</p>
                <p className="text-slate-300">{official.jurisdictionName}</p>
                <p className="font-semibold text-slate-100">{official.status}</p>
                <div>
                  <p className="text-slate-300">{formatDate(official.updatedAt)}</p>
                  <p className="mt-1 text-xs text-slate-500">{official.sourceName ?? "No source"}</p>
                </div>
              </article>
            ))
          ) : (
            <p className="px-4 py-8 text-sm text-slate-400">No normalized officials have been imported yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

