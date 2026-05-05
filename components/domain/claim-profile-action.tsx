import Link from "next/link";

type ClaimProfileActionProps = {
  profileId: string;
  label?: string;
  guestMode?: boolean;
};

export function ClaimProfileAction({ profileId, label = "Claim This Profile", guestMode = false }: ClaimProfileActionProps) {
  return (
    <Link
      href={guestMode ? "/get-started?step=account" : `/claim-profile/${profileId}`}
      className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
    >
      {guestMode ? "Verify to claim" : label}
    </Link>
  );
}
