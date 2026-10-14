import Link from "next/link";

import { slugifyIssueText } from "@/lib/issues/utils";

type IssueTagProps = {
  label: string;
  href?: string | null;
  tone?: "light" | "dark";
  className?: string;
};

export function IssueTag({ label, href, tone = "light", className = "" }: IssueTagProps) {
  const issueHref = href || `/issues/${slugifyIssueText(label)}`;
  const toneClasses =
    tone === "dark"
      ? "border-cyan-300/20 bg-cyan-500/10 text-cyan-100 hover:border-cyan-200/40 hover:bg-cyan-400/15"
      : "border-civic-200 bg-civic-50 text-civic-700 hover:border-civic-400 hover:text-civic-900";

  return (
    <Link
      href={issueHref}
      aria-label={`Related issue: ${label}`}
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold transition ${toneClasses} ${className}`}
    >
      {label}
    </Link>
  );
}
