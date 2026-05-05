import Link from "next/link";

import type { ServiceSummary } from "@/types/domain";

type ServiceCardProps = {
  service: ServiceSummary;
  compact?: boolean;
};

export function ServiceCard({ service, compact = false }: ServiceCardProps) {
  return (
    <article className={`rounded-3xl bg-slate-50 ${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
          {service.category}
        </span>
        {service.relatedIssue ? (
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
            {service.relatedIssue}
          </span>
        ) : null}
      </div>
      <h3 className={`${compact ? "mt-3 text-base" : "mt-3 text-lg"} font-semibold text-ink`}>{service.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{service.description}</p>
      <div className="mt-4 space-y-2 text-sm text-slate-500">
        <p>{service.jurisdictionName}</p>
        <p>Responsible entity: {service.responsibleEntity}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={service.externalLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Open service
        </a>
        {service.responsibleOfficialId ? (
          <Link
            href={`/officials/${service.responsibleOfficialId}`}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            View official
          </Link>
        ) : null}
      </div>
    </article>
  );
}
