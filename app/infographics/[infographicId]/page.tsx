import Link from "next/link";
import { notFound } from "next/navigation";

const infographics = {
  "money-in-politics": {
    title: "Money in Politics",
    description: "A visual explanation of how spending can shape political attention and voter awareness.",
    src: "/infographics/money-in-politics.html",
  },
  "awareness-gap": {
    title: "The Voter Awareness Gap",
    description: "A visual explanation of why voters face too much noise, too little local context, and rising verification costs.",
    src: "/infographics/awareness-gap.html",
  },
} as const;

type InfographicPageProps = {
  params: Promise<{
    infographicId: string;
  }>;
};

export default async function InfographicPage({ params }: InfographicPageProps) {
  const { infographicId } = await params;
  const infographic = infographics[infographicId as keyof typeof infographics];

  if (!infographic) {
    notFound();
  }

  return (
    <div className="space-y-5 py-8">
      <section className="dd-panel rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Animated explainer</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">{infographic.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{infographic.description}</p>
          </div>
          <Link
            href="/auth"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/25 hover:text-cyan-100"
          >
            Back to sign in
          </Link>
        </div>
      </section>

      <section className="dd-panel-muted overflow-hidden rounded-[1.75rem] p-2 sm:p-3">
        <iframe
          title={`${infographic.title} animated infographic`}
          src={infographic.src}
          className="h-[78vh] min-h-[36rem] w-full rounded-[1.35rem] border border-white/10 bg-slate-950"
          sandbox="allow-scripts allow-same-origin"
        />
      </section>
    </div>
  );
}
