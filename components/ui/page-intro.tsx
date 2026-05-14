import type { ReactNode } from "react";

import { getEyebrowIcon } from "@/components/ui/action-icons";

type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  meta?: ReactNode;
  visual?: ReactNode;
};

export function PageIntro({ eyebrow, title, description, actions, meta, visual }: PageIntroProps) {
  const EyebrowIcon = getEyebrowIcon(eyebrow);

  return (
    <section className="dd-panel relative overflow-hidden rounded-[1.9rem] p-6 sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(52,211,153,0.08),transparent_32%)]" />
      <div className={`relative flex flex-col gap-6 ${visual ? "xl:flex-row xl:items-center xl:justify-between" : "lg:flex-row lg:items-end lg:justify-between"}`}>
        <div className={`space-y-4 ${visual ? "xl:max-w-xl" : ""}`}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/18 bg-[linear-gradient(145deg,rgba(22,78,99,0.45),rgba(8,15,28,0.94))] text-cyan-200 shadow-[0_12px_26px_-18px_rgba(34,211,238,0.45)]">
              <EyebrowIcon className="h-5 w-5" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{eyebrow}</p>
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-[2.15rem]">{title}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-400 sm:text-[1.03rem]">{description}</p>
          </div>
          {meta ? <div className="flex flex-wrap gap-2.5">{meta}</div> : null}
        </div>
        {visual ? <div className="xl:w-[min(52%,34rem)]">{visual}</div> : null}
        {actions ? <div className="flex flex-wrap gap-3.5">{actions}</div> : null}
      </div>
    </section>
  );
}
