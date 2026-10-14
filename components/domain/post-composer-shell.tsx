import Link from "next/link";

type PostComposerShellProps = {
  canCreate: boolean;
};

export function PostComposerShell({ canCreate }: PostComposerShellProps) {
  if (!canCreate) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/75 p-6 shadow-card">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Perspective access</p>
        <h2 className="mt-2 text-xl font-semibold text-ink">Read and react</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Citizens can follow contextual civic briefs and react to them. Publishing is reserved for trusted citizens,
          candidates, and officials.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Primary action</p>
      <h2 className="mt-2 text-xl font-semibold text-ink">Create a perspective</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Publish a civic brief tied to a community, issue, profile, election, or coalition. Use a poll when you want a structured public read.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/posts/create"
          className="inline-flex rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700"
        >
          Create perspective
        </Link>
        <Link
          href="/polls/create"
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          Start poll
        </Link>
      </div>
    </section>
  );
}
