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
      className="inline-flex rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700"
    >
      {label}
    </a>
  );
}
