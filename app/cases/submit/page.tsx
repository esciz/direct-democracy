import { PageIntro } from "@/components/ui/page-intro";
import { submitResidentStoryIntake } from "@/lib/cases/resident-intake-actions";

type CaseSubmitPageProps = {
  searchParams?: Promise<{
    submitted?: string;
    error?: string;
    id?: string;
    topic?: string;
    agency?: string;
    community?: string;
    targetType?: string;
    targetId?: string;
  }>;
};

function Field({
  label,
  name,
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-200">
      {label}
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-normal text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/30"
      />
    </label>
  );
}

export default async function CaseSubmitPage({ searchParams }: CaseSubmitPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const submitted = params?.submitted === "1";
  const invalid = params?.error === "invalid";
  const contextTopic = typeof params?.topic === "string" ? params.topic : "";
  const contextAgency = typeof params?.agency === "string" ? params.agency : "";
  const contextCommunity = typeof params?.community === "string" ? params.community : "";
  const contextTargetType = typeof params?.targetType === "string" ? params.targetType : "";
  const contextTargetId = typeof params?.targetId === "string" ? params.targetId : "";

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Case intake"
        title="Ask a civic question or share a concern"
        description="You do not need a formal court case or government file. Share what happened in plain language; submissions are routed for review and are not sent or published automatically."
        meta={
          <span className="rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
            Moderation queue foundation
          </span>
        }
      />

      {submitted ? (
        <section className="rounded-[1.75rem] border border-emerald-300/20 bg-emerald-500/10 p-5 text-sm leading-6 text-emerald-100">
          <p className="font-semibold text-emerald-50">Story received for review.</p>
          <p className="mt-2">
            Public status: received. A reviewer can route it to the right body, request sources, or publish a reviewed answer later. It remains private unless source verification,
            moderation, and your publication preference allow a public or anonymous summary.
          </p>
          {params?.id ? <p className="mt-2 text-xs text-emerald-200/80">Review reference: {params.id}</p> : null}
        </section>
      ) : null}

      {invalid ? (
        <section className="rounded-[1.75rem] border border-rose-300/20 bg-rose-500/10 p-5 text-sm leading-6 text-rose-100">
          Please include a plain-language story of at least 20 characters. Uploads and links are optional.
        </section>
      ) : null}

      <form action={submitResidentStoryIntake} className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <input type="hidden" name="routingTargetType" value={contextTargetType} />
        <input type="hidden" name="routingTargetId" value={contextTargetId} />
        <input type="hidden" name="routingTopic" value={contextTopic} />
        <input type="hidden" name="routingAgency" value={contextAgency} />
        <input type="hidden" name="routingCommunity" value={contextCommunity} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Resident question</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Tell us what happened</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Keep public civic truth separate from your unverified submission. Reviewers use this to identify timelines, agencies, public records, routing targets, and safety/moderation needs.
          </p>
        </div>

        <label className="mt-6 grid gap-2 text-sm font-semibold text-slate-200">
          What kind of concern is this?
          <select
            name="submissionType"
            defaultValue="something_happened_to_me"
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-normal text-slate-100 outline-none focus:border-cyan-300/30"
          >
            <option value="something_happened_to_me">Something happened to me</option>
            <option value="something_happened_to_loved_one">Something happened to a loved one</option>
            <option value="public_safety_concern">Public safety concern</option>
            <option value="infrastructure_or_city_project_concern">Infrastructure or city project concern</option>
            <option value="government_service_failure">Government service failure</option>
            <option value="court_or_legal_matter">Court or legal matter</option>
            <option value="official_misconduct_or_accountability_concern">Official misconduct or accountability concern</option>
            <option value="other_civic_concern">Other civic concern</option>
          </select>
        </label>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Location
            <input
              name="location"
              defaultValue={contextCommunity}
              placeholder="Street, neighborhood, community, agency office, or online service"
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-normal text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/30"
            />
          </label>
          <Field label="Approximate date" name="approximateDate" placeholder="Exact date, month/year, or approximate timeframe" />
        </div>

        {contextTopic || contextAgency ? (
          <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-50">
            <p className="font-semibold">Context carried from the page you were viewing.</p>
            {contextTopic ? <p className="mt-1">Topic: {contextTopic}</p> : null}
            {contextAgency ? <p className="mt-1">Agency/body: {contextAgency}</p> : null}
            <p className="mt-2 text-cyan-100/80">You can edit the story below. This enters routing review and is not emailed or published automatically.</p>
          </div>
        ) : null}

        <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-200">
          Your story
          <textarea
            name="story"
            required
            rows={8}
            defaultValue={contextTopic ? `I have a question or concern about: ${contextTopic}${contextAgency ? `\nAgency/body: ${contextAgency}` : ""}\n\n` : undefined}
            placeholder="Describe what happened in plain language. Include what you tried, what response you received, and what you think residents or reviewers should understand."
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-normal leading-6 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/30"
          />
        </label>

        <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-200">
          People, agencies, companies, or officials involved
          <textarea
            name="peopleOrEntitiesInvolved"
            rows={4}
            placeholder="List names if known. You can leave this blank."
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-normal leading-6 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/30"
          />
        </label>

        <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-200">
          Optional links
          <textarea
            name="links"
            rows={3}
            placeholder="Public records, news links, meeting pages, case lookup pages, photos, or documents. Optional."
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-normal leading-6 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/30"
          />
        </label>

        <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-200">
          Upload documents, photos, or notices
          <input
            name="documents"
            type="file"
            multiple
            className="rounded-2xl border border-dashed border-white/14 bg-white/[0.04] px-4 py-3 text-sm font-normal text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
          />
          <span className="text-xs font-normal text-slate-500">Optional. Uploads are review material and are not published automatically.</span>
        </label>

        <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-200">
          Publication preference
          <select
            name="publicationPreference"
            defaultValue="private"
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-normal text-slate-100 outline-none focus:border-cyan-300/30"
          >
            <option value="private">Keep private pending review</option>
            <option value="public_after_review">May be public after review</option>
            <option value="anonymous_after_review">May be anonymous after review</option>
          </select>
        </label>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            "Safety flags check for personal data, allegations, minors, and legal matters.",
            "Reviewer workflow can route the question to the best body, mark needs-source, ready-to-send, answered, or closed.",
            "Moderators verify public sources before any public story or case page is created.",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
              {item}
            </div>
          ))}
        </div>

        <button type="submit" className="mt-6 rounded-full bg-[linear-gradient(135deg,#34d399,#22d3ee)] px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_34px_-24px_rgba(45,212,191,0.9)]">
          Send to review
        </button>
      </form>
    </div>
  );
}
