import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { getAdminInitiatives } from "@/lib/civic-data/service";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

export default async function AdminInitiativesPage() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const initiatives = await getAdminInitiatives();

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Ballot initiatives"
        description="Review normalized ballot questions and initiatives connected to elections and jurisdictions."
        actions={
          <Link href="/admin/data" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
            Dashboard
          </Link>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="grid gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 md:grid-cols-[1.1fr_0.8fr_0.8fr_0.6fr_0.7fr]">
          <span>Initiative</span>
          <span>Election</span>
          <span>Jurisdiction</span>
          <span>Status</span>
          <span>Updated</span>
        </div>
        <div className="divide-y divide-white/10">
          {initiatives.length > 0 ? (
            initiatives.map((initiative) => (
              <article key={initiative.id} className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.1fr_0.8fr_0.8fr_0.6fr_0.7fr]">
                <div>
                  <p className="font-semibold text-slate-50">{initiative.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{initiative.measureNumber ?? "No measure number"}</p>
                </div>
                <p className="text-slate-300">{initiative.electionTitle}</p>
                <p className="text-slate-300">{initiative.jurisdictionName}</p>
                <p className="font-semibold text-slate-100">{initiative.status}</p>
                <div>
                  <p className="text-slate-300">{formatDate(initiative.updatedAt)}</p>
                  <p className="mt-1 text-xs text-slate-500">{initiative.sourceName ?? "No source"}</p>
                </div>
              </article>
            ))
          ) : (
            <p className="px-4 py-8 text-sm text-slate-400">No normalized ballot initiatives have been imported yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

