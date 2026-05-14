type DonateButtonProps = {
  href?: string | null;
  label?: string;
};

export function DonateButton({ href, label = "Donate" }: DonateButtonProps) {
  if (!href) {
    return null;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex rounded-full border border-amber-300/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.92),rgba(217,119,6,0.96))] px-4 py-3 text-sm font-semibold text-amber-950 shadow-[0_18px_40px_-24px_rgba(245,158,11,0.65)] transition hover:-translate-y-0.5 hover:brightness-105"
    >
      {label}
    </a>
  );
}
