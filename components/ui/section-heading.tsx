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
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-300/18 bg-[linear-gradient(145deg,rgba(22,78,99,0.45),rgba(8,15,28,0.94))] text-cyan-200 shadow-[0_14px_30px_-18px_rgba(34,211,238,0.38)]">
          <EyebrowIcon className="h-[1.125rem] w-[1.125rem]" />
        </span>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">{eyebrow}</p>
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-slate-50">{title}</h2>
      <p className="max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}
