import Link from "next/link";

import type { SchoolSummary } from "@/types/domain";

type SchoolCardProps = {
  school: SchoolSummary;
  compact?: boolean;
};

export function SchoolCard({ school, compact = false }: SchoolCardProps) {
  return (
    <article className={`rounded-3xl bg-slate-50 ${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
          {school.district}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Grades {school.gradeLevels.join("–")}
        </span>
      </div>
      <h3 className={`${compact ? "mt-3 text-base" : "mt-3 text-lg"} font-semibold text-ink`}>{school.name}</h3>
      <p className="mt-2 text-sm text-slate-600">{school.jurisdictionName}</p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
        {typeof school.enrollment === "number" ? <span>{school.enrollment.toLocaleString()} students</span> : null}
        {typeof school.studentTeacherRatio === "number" ? <span>{school.studentTeacherRatio.toFixed(1)} student-teacher ratio</span> : null}
      </div>
      <Link
        href={`/schools/${school.id}`}
        className="mt-4 inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
      >
        View school
      </Link>
    </article>
  );
}
