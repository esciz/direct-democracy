import { getEyebrowIcon } from "@/components/ui/action-icons";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  const EyebrowIcon = getEyebrowIcon(eyebrow);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-civic-200/80 bg-[linear-gradient(145deg,rgba(224,242,254,0.96),rgba(255,255,255,0.92))] text-civic-700 shadow-[0_10px_24px_-18px_rgba(14,165,233,0.95)]">
          <EyebrowIcon className="h-[1.125rem] w-[1.125rem]" />
        </span>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-civic-700">{eyebrow}</p>
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
