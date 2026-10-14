import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { addCandidateSourceForReviewAction } from "@/lib/civic-data/candidate-source-actions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

const SOURCE_TYPES = [
  ["campaign_site", "Campaign website"],
  ["official_site", "Official website"],
  ["ballotpedia", "Ballotpedia"],
  ["news", "News article"],
  ["social", "Social profile"],
  ["candidate_statement", "Candidate statement"],
  ["campaign_finance", "Campaign finance"],
  ["other", "Other"],
] as const;

type AddSourcePageProps = {
  searchParams?: Promise<{
    candidateId?: string;
    sourceType?: string;
    added?: string;
  }>;
};

export default async function AddCandidateKnowledgeSourcePage({ searchParams }: AddSourcePageProps) {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    redirect("/profile");
  }

  const params = searchParams ? await searchParams : {};
  const candidates = await prisma.candidate.findMany({
    include: {
      election: { select: { title: true, electionDate: true } },
      office: { select: { title: true } },
      jurisdiction: { select: { name: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { fullName: "asc" }],
    take: 300,
  });
  const selectedCandidate = candidates.find((candidate) => candidate.id === params.candidateId) ?? candidates[0] ?? null;
  const selectedSourceType = SOURCE_TYPES.some(([value]) => value === params.sourceType) ? params.sourceType : "campaign_site";

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin · Candidate Knowledge"
        title="Add candidate source"
        description="Attach a real source URL to a candidate profile. Added sources stay pending review and extraction until an admin approves derived content."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/data-factory/candidate-knowledge" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Knowledge queue
            </Link>
            <Link href="/admin/data-factory" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Data Factory
            </Link>
          </div>
        }
      />

      {params.added ? (
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm font-semibold text-emerald-100">
          Source added as pending review. Run candidate knowledge extraction when ready.
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <form action={addCandidateSourceForReviewAction} className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="grid gap-5">
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Candidate
              <select name="candidateId" defaultValue={selectedCandidate?.id} className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100">
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.ballotName ?? candidate.fullName} - {candidate.office?.title ?? candidate.election.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Source URL
              <input
                name="sourceUrl"
                type="url"
                required
                placeholder="https://..."
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Source type
              <select name="sourceType" defaultValue={selectedSourceType} className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100">
                {SOURCE_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Notes
              <textarea
                name="notes"
                rows={4}
                placeholder="Why this source belongs to the candidate, what extraction should look for, or review cautions."
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-slate-100 placeholder:text-slate-600"
              />
            </label>

            <button className="dd-button-primary rounded-full px-5 py-3 text-sm font-semibold" type="submit">
              Add source for review
            </button>
          </div>
        </form>

        <aside className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Selected candidate</p>
          {selectedCandidate ? (
            <div className="mt-4 space-y-3">
              <p className="text-xl font-semibold text-slate-50">{selectedCandidate.ballotName ?? selectedCandidate.fullName}</p>
              <p className="text-sm leading-6 text-slate-400">{selectedCandidate.office?.title ?? selectedCandidate.election.title}</p>
              <p className="text-sm leading-6 text-slate-400">{selectedCandidate.jurisdiction.name}</p>
              <Link href={`/candidates/${selectedCandidate.id}`} className="inline-flex text-sm font-semibold text-cyan-200 hover:text-cyan-100">
                Open public profile
              </Link>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-400">No candidate records are available to attach sources to.</p>
          )}
          <div className="mt-6 rounded-2xl border border-amber-300/18 bg-amber-500/10 p-4 text-xs leading-5 text-amber-100">
            This form stores URLs only. Public profile fields are not changed until sourced content is extracted and approved or verified.
          </div>
        </aside>
      </section>
    </div>
  );
}
