import Link from "next/link";

type ClaimProfilePlaceholderProps = {
  profileName: string;
  profileLabel: string;
  jurisdictionName: string;
};

export function ClaimProfilePlaceholder({
  profileName,
  profileLabel,
  jurisdictionName,
}: ClaimProfilePlaceholderProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="max-w-3xl space-y-5">
        <div className="space-y-3">
          <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
            Unclaimed Profile
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">Claim {profileName}&apos;s profile</h1>
            <p className="mt-2 text-sm text-slate-500">
              {profileLabel} · {jurisdictionName}
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-slate-50 p-5">
          <h2 className="text-lg font-semibold text-ink">Claiming is planned for a future version</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            This public profile is currently unclaimed. For MVP, admins populate candidate and official profiles so
            elections, offices, and public records are visible even before someone joins the platform.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            A future release will support a real claim flow that links a verified platform account to the public
            profile. That workflow is not live yet, so this page is only here to explain the concept.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/elections"
            className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            View elections
          </Link>
          <Link
            href="/officials"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Browse officials
          </Link>
        </div>
      </div>
    </section>
  );
}
