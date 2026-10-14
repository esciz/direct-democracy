import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { getAdminCandidates } from "@/lib/civic-data/service";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

export default async function AdminCandidatesPage() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const candidates = await getAdminCandidates();

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Candidates"
        description="Review imported candidates, candidate offices, election links, and source attribution."
        actions={
          <Link href="/admin/imports" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
            Imports
          </Link>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="grid gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 md:grid-cols-[1fr_1fr_0.9fr_0.7fr_0.7fr_0.8fr]">
          <span>Candidate</span>
          <span>Election</span>
          <span>Office</span>
          <span>Jurisdiction</span>
          <span>Status</span>
          <span>Profile data</span>
        </div>
        <div className="divide-y divide-white/10">
          {candidates.length > 0 ? (
            candidates.map((candidate) => (
              <article key={candidate.id} className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1fr_1fr_0.9fr_0.7fr_0.7fr_0.8fr]">
                <div>
                  <p className="font-semibold text-slate-50">{candidate.fullName}</p>
                  <p className="mt-1 text-xs text-slate-400">{candidate.ballotName ?? candidate.partyText ?? "No ballot label"}</p>
                </div>
                <p className="text-slate-300">{candidate.electionTitle}</p>
                <div>
                  <p className="text-slate-300">{candidate.officeTitle ?? "Unassigned"}</p>
                  <p className="mt-1 text-xs text-slate-500">{candidate.districtName ?? "No district"}</p>
                </div>
                <p className="text-slate-300">{candidate.jurisdictionName}</p>
                <div>
                  <p className="font-semibold text-slate-100">{candidate.status}</p>
                  <p className="mt-1 text-xs text-slate-500">{candidate.filingStatus ?? candidate.sourceName ?? "No source"}</p>
                </div>
                <div className="space-y-1 text-xs text-slate-400">
                  <p>{candidate.email ? "Email" : "No email"} · {candidate.phone ? "Phone" : "No phone"}</p>
                  <p>{candidate.websiteUrl ? "Website" : "No website"} · {candidate.sourceUrl ? "Source URL" : "No source URL"}</p>
                </div>
              </article>
            ))
          ) : (
            <p className="px-4 py-8 text-sm text-slate-400">No imported candidates are available yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
