import Link from "next/link";

import { ProfileImagePlaceholder } from "@/components/domain/profile-image-placeholder";
import type { OfficialProfileSummary } from "@/types/domain";

type MyOfficialCardProps = {
  official: OfficialProfileSummary;
};

export function MyOfficialCard({ official }: MyOfficialCardProps) {
  return (
    <article className="rounded-3xl bg-slate-50 p-5">
      <div className="flex items-start gap-4">
        <ProfileImagePlaceholder name={official.name} imageUrl={official.profileImageUrl} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-ink">{official.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {official.officeTitle} · {official.jurisdictionName}
          </p>
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
