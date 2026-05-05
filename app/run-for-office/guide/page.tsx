import { RunForOfficeGuide } from "@/components/domain/run-for-office-guide";
import { PageIntro } from "@/components/ui/page-intro";

export default function RunForOfficeGuidePage() {
  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Run for Office"
        title="How to run for office"
        description="A simple, neutral guide for people exploring a path from trusted community voice to candidate. Use official election offices for real filing rules and deadlines."
        meta={
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            General guidance, not legal advice
          </span>
        }
      />
      <RunForOfficeGuide />
    </div>
  );
}
