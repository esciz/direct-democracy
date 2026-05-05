import Link from "next/link";

type MessageProfileButtonProps = {
  recipientUserId: string;
};

export function MessageProfileButton({ recipientUserId }: MessageProfileButtonProps) {
  return (
    <Link
      href={`/messages/new?recipientUserId=${recipientUserId}`}
      className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
    >
      Message
    </Link>
  );
}
