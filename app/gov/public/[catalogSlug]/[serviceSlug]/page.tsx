import Link from "next/link";
import { notFound } from "next/navigation";

import { requireGovCrmAccess } from "@/lib/govcrm/access";
import { getServiceAction, getServiceActionStatusLabel, type ServiceAction } from "@/lib/govcrm/submission-engine";

type GovPublicServiceDetailPageProps = {
  params: Promise<{ catalogSlug: string; serviceSlug: string }>;
};

export const dynamic = "force-dynamic";

function startBehavior(action: ServiceAction) {
  switch (action.actionType) {
    case "external_link":
      return {
        label: "Open official source",
        description: "This preview sends residents to the official source. GovCRM will not submit into third-party systems without authorization.",
        href: action.externalSubmissionUrl ?? action.sourceUrl,
        external: true,
      };
    case "document_upload":
    case "pdf_submission":
      return {
        label: "Upload placeholder",
        description: "Uploaded PDFs/images will become CivicDocument records, run extraction, and wait for staff review.",
        href: "/gov/documents/upload",
        external: false,
      };
    case "form_fill":
      return {
        label: "Form-fill placeholder",
        description: "For enrolled clients, structured answers can generate a PDF or internal staff review package.",
        href: "/gov/forms",
        external: false,
      };
    case "case_intake":
    case "report_issue":
    case "complaint":
    case "records_request":
    case "permit_application":
    case "filing":
    case "public_comment":
      return {
        label: "Start intake placeholder",
        description: "This will create a GovCRM submission for staff routing after the client enables the workflow.",
        href: "/gov/submissions",
        external: false,
      };
    default:
      return {
        label: "View official source",
        description: "Information-only services show official source context and related actions.",
        href: action.sourceUrl,
        external: true,
      };
  }
}

export default async function GovPublicServiceDetailPage({ params }: GovPublicServiceDetailPageProps) {
  await requireGovCrmAccess();
  const { catalogSlug, serviceSlug } = await params;
  const result = getServiceAction(catalogSlug, serviceSlug);
  if (!result) notFound();
  const { catalog, category, action } = result;
  const behavior = startBehavior(action);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-16 pt-2 sm:px-6 lg:px-8">
      <Link href={`/gov/public/${catalog.slug}`} className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
        Back to {catalog.governmentEntityName}
      </Link>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">{category.name}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{action.title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{action.publicUserDescription}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
            {getServiceActionStatusLabel(action)}
          </span>
          {action.requiresStaffReview ? <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">Staff review required</span> : null}
          {action.requiresPayment ? <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">Payment may apply</span> : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-semibold text-white">What this is</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">{action.description}</p>
        </article>
        <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-semibold text-white">Who should use it</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">Residents, applicants, candidates, businesses, or staff who need this official {catalog.governmentEntityName} service path.</p>
        </article>
        <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-semibold text-white">What you need</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {(action.requiredDocuments.length ? action.requiredDocuments : ["Official requirements pending catalog review"]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-lg font-semibold text-white">Fees and review</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {action.requiresPayment ? "Payment may be required by the official agency." : "No fee has been configured in this preview."}{" "}
            {action.requiresStaffReview ? "Staff review is expected before completion." : "Staff review is not configured for this preview action."}
          </p>
        </article>
      </section>

      <section className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-lg font-semibold text-white">Start</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{behavior.description}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {behavior.external ? (
            <a href={behavior.href} target="_blank" rel="noreferrer" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              {behavior.label}
            </a>
          ) : (
            <Link href={behavior.href} className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              {behavior.label}
            </Link>
          )}
          <a href={action.sourceUrl || catalog.sourceUrl} target="_blank" rel="noreferrer" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
            Source / official link
          </a>
        </div>
      </section>
    </main>
  );
}
