import Link from "next/link";

import { CivicAvatar } from "@/components/domain/civic-avatar";
import type { OfficialProfileSummary } from "@/types/domain";

type MyOfficialCardProps = {
  official: OfficialProfileSummary;
};

export function MyOfficialCard({ official }: MyOfficialCardProps) {
  return (
    <article className="rounded-3xl bg-slate-50 p-5">
      <div className="flex items-start gap-4">
        <CivicAvatar name={official.name} imageUrl={official.profileImageUrl} entityType="official" size="lg" verified />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-ink">{official.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {official.officeTitle} · {official.jurisdictionName}
          </p>
          {official.sourceLabel ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Imported Nevada beta data</p> : null}
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{official.bio}</p>
        </div>
      </div>
      <Link
        href={`/officials/${official.id}`}
        className="mt-4 inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
      >
        View official
      </Link>
    </article>
  );
}
