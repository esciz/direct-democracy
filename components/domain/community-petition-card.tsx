import Link from "next/link";

import type { PetitionSummary } from "@/types/domain";

type CommunityPetitionCardProps = {
  petition: PetitionSummary;
};

export function CommunityPetitionCard({ petition }: CommunityPetitionCardProps) {
  return (
    <article className="rounded-3xl bg-slate-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{petition.jurisdictionName}</p>
      <h3 className="mt-2 text-lg font-semibold text-ink">{petition.title}</h3>
      <p className="mt-3 text-sm text-slate-600">
        {petition.signatureCount.toLocaleString()} signatures · {petition.status.toLowerCase().replaceAll("_", " ")}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/petitions/${petition.id}`}
          className="inline-flex rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700"
        >
          {petition.eligibleForCosponsorship ? "View petition" : "Sign petition"}
        </Link>
      </div>
    </article>
  );
}
