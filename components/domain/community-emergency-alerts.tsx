import { AlertTriangle, ExternalLink, HeartHandshake, MapPinned, Phone, Route, ShieldCheck } from "lucide-react";

import { CivicDetails } from "@/components/ui/civic-details";
import type { CommunityEmergencyState } from "@/lib/emergency/community-alerts";

function formatAlertTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function CommunityEmergencyAlerts({ communityName, state }: { communityName: string; state: CommunityEmergencyState }) {
  if (!state.notices.length) return null;

  const primary = state.notices[0];
  const otherNotices = state.notices.slice(1);
  const isImmediateAlert = primary.kind === "alert";

  return (
    <section aria-labelledby="community-emergency-heading" className="overflow-hidden rounded-[1.75rem] border border-amber-300/30 bg-[linear-gradient(145deg,rgba(69,26,3,0.82),rgba(15,23,42,0.96))] shadow-[0_26px_70px_-38px_rgba(251,146,60,0.7)]">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-200/25 bg-amber-300/12 text-amber-200">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">{isImmediateAlert ? "Active official alert" : "Recent official declaration"}</p>
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-200">{primary.severity}</span>
                {primary.urgency ? <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{primary.urgency}</span> : null}
              </div>
              <h2 id="community-emergency-heading" className="mt-3 text-2xl font-semibold leading-tight text-slate-50 sm:text-3xl">{primary.title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">{primary.summary}</p>
              {primary.instruction ? (
                <div className="mt-4 rounded-2xl border border-amber-200/20 bg-black/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Official guidance</p>
                  <p className="mt-2 text-sm leading-6 text-slate-100">{primary.instruction}</p>
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-3">
                <a href={primary.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-amber-300 px-4 py-2 text-sm font-bold text-amber-950 hover:bg-amber-200">
                  Open official alert <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
                <a href="tel:211" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-white/30">
                  <Phone className="h-4 w-4" aria-hidden="true" /> Call 211 for local help
                </a>
              </div>
              <CivicDetails label="Area, timing, and source" className="mt-5 border-white/12 text-slate-300">
                <p><strong className="text-slate-100">Affected area:</strong> {primary.area}</p>
                <p><strong className="text-slate-100">Effective:</strong> {formatAlertTime(primary.effectiveAt) ?? "See official alert"}</p>
                <p><strong className="text-slate-100">Expires:</strong> {formatAlertTime(primary.expiresAt) ?? "No end time provided"}</p>
                <p><strong className="text-slate-100">Source:</strong> {primary.sourceName}</p>
                <p>This is supplemental civic information. Follow official instructions and call 911 for immediate danger.</p>
              </CivicDetails>
            </div>
          </div>

          {otherNotices.length ? (
            <CivicDetails label={`${otherNotices.length} more official notice${otherNotices.length === 1 ? "" : "s"}`} className="mt-5 border-white/12">
              <div className="grid gap-3 sm:grid-cols-2">
                {otherNotices.map((notice) => (
                  <a key={notice.id} href={notice.sourceUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 bg-black/15 p-4 hover:border-amber-200/25">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">{notice.kind === "alert" ? notice.severity : "Declaration"}</p>
                    <p className="mt-2 text-sm font-semibold leading-5 text-slate-50">{notice.title}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{notice.area}</p>
                  </a>
                ))}
              </div>
            </CivicDetails>
          ) : null}
        </div>

        <aside className="border-t border-white/10 bg-black/15 p-6 lg:border-l lg:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Find help near {communityName}</p>
          <div className="mt-4 space-y-3">
            {[
              { href: "https://www.redcross.org/get-help/disaster-relief-and-recovery-services/find-an-open-shelter.html", label: "Open shelters", detail: "Red Cross shelter finder", icon: MapPinned },
              { href: "https://www.211.org/", label: "Food, housing, and local aid", detail: "Call or search 211", icon: HeartHandshake },
              { href: "https://www.dot.nv.gov/travel-info", label: "Road conditions", detail: "Nevada 511 and closures", icon: Route },
              { href: "https://dem.nv.gov/", label: "State emergency information", detail: "Nevada emergency management", icon: ShieldCheck },
            ].map((resource) => {
              const Icon = resource.icon;
              return (
                <a key={resource.href} href={resource.href} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 hover:border-amber-200/25 hover:bg-white/8">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-100">{resource.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-400">{resource.detail}</span>
                  </span>
                </a>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] leading-5 text-slate-400">Official feeds checked {formatAlertTime(state.checkedAt)}. Resource availability can change quickly; confirm before traveling.</p>
        </aside>
      </div>
    </section>
  );
}
