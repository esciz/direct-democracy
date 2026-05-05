import type { ReactNode } from "react";

type ExplanationPanelProps = {
  title: string;
  summary: string;
  children: ReactNode;
  compact?: boolean;
};

export function ExplanationPanel({ title, summary, children, compact = false }: ExplanationPanelProps) {
  return (
    <details className={`rounded-[1.5rem] border border-slate-200 bg-white/85 ${compact ? "p-4" : "p-5"}`}>
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{summary}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">How it works</span>
        </div>
      </summary>
      <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">{children}</div>
    </details>
  );
}
