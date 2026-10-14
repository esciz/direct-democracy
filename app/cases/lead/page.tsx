import Link from "next/link";

import { PageIntro } from "@/components/ui/page-intro";

export default function CaseLeadPage() {
  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Case lead"
        title="Know about a public case?"
        description="This is a safe intake placeholder. Direct Democracy does not publish citizen-provided legal details until public records are verified."
      />

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-50">How this will work</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[
            "Submit a case number, court, jurisdiction, and optional public source link.",
            "The system stores it as pending review and looks for official public records later.",
            "Plain-English summaries are created only after source verification.",
            "Private or sensitive information is not published.",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Current status</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Intake architecture exists, but public submission is not enabled yet. This keeps sensitive case information out of the public product until verification and review are ready.
        </p>
        <Link href="/cases" className="mt-5 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100">
          Browse reviewed cases
        </Link>
      </section>
    </div>
  );
}
