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
    <section className="relative overflow-hidden rounded-[1.9rem] border border-white/75 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-6 shadow-card backdrop-blur sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(15,23,42,0.08),transparent_32%)]" />
      <div className={`relative flex flex-col gap-6 ${visual ? "xl:flex-row xl:items-center xl:justify-between" : "lg:flex-row lg:items-end lg:justify-between"}`}>
        <div className={`space-y-4 ${visual ? "xl:max-w-xl" : ""}`}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-civic-200/80 bg-[linear-gradient(145deg,rgba(224,242,254,0.95),rgba(255,255,255,0.92))] text-civic-700 shadow-[0_12px_26px_-18px_rgba(14,165,233,0.9)]">
              <EyebrowIcon className="h-5 w-5" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-civic-700">{eyebrow}</p>
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-[2.15rem]">{title}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-[1.03rem]">{description}</p>
          </div>
          {meta ? <div className="flex flex-wrap gap-2.5">{meta}</div> : null}
        </div>
        {visual ? <div className="xl:w-[min(52%,34rem)]">{visual}</div> : null}
        {actions ? <div className="flex flex-wrap gap-3.5">{actions}</div> : null}
      </div>
    </section>
  );
}
