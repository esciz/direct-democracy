import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { getAdminElections } from "@/lib/civic-data/service";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

export default async function AdminElectionsPage() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const elections = await getAdminElections();

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Elections"
        description="Review normalized elections and their jurisdiction, office, status, and source attribution."
        actions={
          <Link href="/admin/data" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
            Dashboard
          </Link>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="grid gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 md:grid-cols-[1.1fr_0.8fr_0.8fr_0.7fr_0.6fr]">
          <span>Election</span>
          <span>Jurisdiction</span>
          <span>Office</span>
          <span>Date</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-white/10">
          {elections.length > 0 ? (
            elections.map((election) => (
              <article key={election.id} className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.1fr_0.8fr_0.8fr_0.7fr_0.6fr]">
                <div>
                  <p className="font-semibold text-slate-50">{election.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{election.electionType.replaceAll("_", " ")}</p>
                </div>
                <p className="text-slate-300">{election.jurisdictionName}</p>
                <p className="text-slate-300">{election.officeTitle}</p>
                <p className="text-slate-300">{formatDate(election.electionDate)}</p>
                <div>
                  <p className="font-semibold text-slate-100">{election.status}</p>
                  <p className="mt-1 text-xs text-slate-500">{election.sourceName ?? "No source"}</p>
                </div>
              </article>
            ))
          ) : (
            <p className="px-4 py-8 text-sm text-slate-400">No normalized elections have been imported yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

