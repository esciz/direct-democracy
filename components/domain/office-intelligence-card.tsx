import type { OfficeIntelligence } from "@/lib/candidates/office-intelligence";

function ChipList({ items }: { items: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200">
          {item}
        </span>
      ))}
    </div>
  );
}

export function OfficeIntelligenceCard({ intelligence }: { intelligence: OfficeIntelligence }) {
  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">What this office does</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{intelligence.label}</h2>
      <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300">{intelligence.whatOfficeDoes}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Power of the office</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            {intelligence.powers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">What voters should look for</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            {intelligence.votersShouldLookFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Typical issues handled</p>
          <ChipList items={intelligence.typicalIssues} />
        </div>
      </div>

      <div className="mt-5 rounded-[1.35rem] border border-cyan-300/18 bg-cyan-300/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Questions voters should ask</p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-100">
          {intelligence.questionsToAsk.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">{intelligence.sourceNote}</p>
    </section>
  );
}
