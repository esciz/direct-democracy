"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type FloatingCreateAction = {
  href: string;
  label: string;
  description: string;
  group: string;
};

type FloatingCreateMenuClientProps = {
  actions: FloatingCreateAction[];
};

const GROUP_ORDER = ["Publish", "Organize", "Outreach"] as const;

export function FloatingCreateMenuClient({ actions }: FloatingCreateMenuClientProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (pathname === "/") {
    return null;
  }

  const groupedActions = GROUP_ORDER.map((group) => ({
    group,
    actions: actions.filter((action) => action.group === group),
  })).filter((entry) => entry.actions.length > 0);

  return (
    <>
      {open ? <button type="button" aria-label="Close create menu" className="fixed inset-0 z-30 bg-slate-950/10" onClick={() => setOpen(false)} /> : null}
      <div className="mobile-floating-create fixed right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:bottom-6 sm:right-6">
        {open ? (
          <section
            id="global-create-menu"
            className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/96 shadow-2xl backdrop-blur"
          >
            <div className="border-b border-slate-200/80 px-4 py-4">
              <p className="text-sm font-semibold text-ink">Create something new</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Only the flows available to this profile are shown here.</p>
            </div>

            {groupedActions.length ? (
              <div className="max-h-[70vh] overflow-y-auto px-3 py-3">
                {groupedActions.map((group) => (
                  <div key={group.group} className="pb-2 pt-1 last:pb-0">
                    <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group.group}</p>
                    <div className="space-y-1">
                      {group.actions.map((action) => (
                        <Link
                          key={action.href}
                          href={action.href}
                          className="block rounded-2xl px-3 py-3 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-civic-500"
                        >
                          <p className="text-sm font-semibold text-ink">{action.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{action.description}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-4 text-sm leading-6 text-slate-600">
                This profile does not have any create flows available right now.
              </div>
            )}
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="global-create-menu"
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-civic-500 focus-visible:ring-offset-2"
        >
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/12 text-lg leading-none"
          >
            +
          </span>
          <span>Create</span>
        </button>
      </div>
    </>
  );
}
