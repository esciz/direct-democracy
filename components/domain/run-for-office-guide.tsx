type ResourceLink = {
  label: string;
  href: string;
  description: string;
};

const officialResources: ResourceLink[] = [
  {
    label: "Nevada Secretary of State",
    href: "https://www.nvsos.gov/",
    description: "Official statewide election and candidate information. Use this as a starting point for filing timelines and election rules.",
  },
  {
    label: "Carson City Elections",
    href: "https://www.carson.org/elections",
    description: "Official local election office information for Carson City, including clerk-recorder contact details and election services.",
  },
];

const officeTypes = [
  {
    title: "Local office",
    description: "City council, mayor, school board, county commission, and similar roles closest to day-to-day community issues.",
  },
  {
    title: "State office",
    description: "Legislative and statewide offices that shape education, housing, water, infrastructure, and budget policy at the Nevada level.",
  },
  {
    title: "Federal office",
    description: "Congressional roles with larger constituencies and broader campaign requirements. Best treated as a later step unless you already have a strong base.",
  },
];

const requirements = [
  "Age requirements vary by office, so always confirm them through the official election authority for the office you want.",
  "Residency requirements usually matter and may differ between local, state, and federal races.",
  "Voter registration is commonly part of basic eligibility, but the exact rule depends on the office and jurisdiction.",
];

const campaignBasics = [
  "Define a clear message rooted in issues people already associate with you.",
  "Build outreach around community listening, not just announcements.",
  "Translate visibility into trust with consistent follow-through and local issue clarity.",
];

export function RunForOfficeGuide() {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Choose an office</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Start with the level of office that fits your goals</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {officeTypes.map((office) => (
            <article key={office.title} className="rounded-3xl bg-slate-50 p-5">
              <h3 className="text-lg font-semibold text-ink">{office.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{office.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Basic requirements</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">General things to confirm before you run</h2>
        <div className="mt-5 space-y-3">
          {requirements.map((requirement) => (
            <div key={requirement} className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {requirement}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-500">
          This page is general guidance only and does not replace official filing instructions or legal advice.
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Filing process</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Use official election resources for real deadlines and forms</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {officialResources.map((resource) => (
            <article key={resource.href} className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Official source</p>
              <h3 className="mt-2 text-lg font-semibold text-ink">{resource.label}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{resource.description}</p>
              <a
                href={resource.href}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              >
                Open official site
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Build your base</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">What this platform can already help you build</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-slate-50 p-5">
            <h3 className="text-lg font-semibold text-ink">Platform signals</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>Followers show whether people choose to keep up with your civic voice.</li>
              <li>Endorsements show structured public support from verified citizens.</li>
              <li>Visibility and posts help people connect your name to clear issues.</li>
              <li>Issue alignment helps you understand whether your priorities match your community.</li>
            </ul>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <h3 className="text-lg font-semibold text-ink">Campaign basics</h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              {campaignBasics.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
