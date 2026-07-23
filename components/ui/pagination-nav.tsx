import Link from "next/link";

type PaginationNavProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemLabel: string;
  previousHref: string | null;
  nextHref: string | null;
};

export function PaginationNav({
  currentPage,
  totalPages,
  totalItems,
  itemLabel,
  previousHref,
  nextHref,
}: PaginationNavProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5" aria-label={`${itemLabel} pages`}>
      <p className="text-sm text-slate-600">
        Page {currentPage} of {totalPages} · {totalItems.toLocaleString()} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        {previousHref ? (
          <Link href={previousHref} scroll={false} className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
            Previous
          </Link>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400">Previous</span>
        )}
        {nextHref ? (
          <Link href={nextHref} scroll={false} className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
            Next
          </Link>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400">Next</span>
        )}
      </div>
    </nav>
  );
}
