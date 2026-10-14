import Link from "next/link";

type MessageProfileButtonProps = {
  recipientUserId: string;
};

export function MessageProfileButton({ recipientUserId }: MessageProfileButtonProps) {
  return (
    <Link
      href={`/messages/new?recipientUserId=${recipientUserId}`}
      className="dd-button-secondary inline-flex rounded-full px-4 py-3 text-sm font-semibold transition hover:border-cyan-300/30 hover:text-white"
    >
      Message
    </Link>
  );
}
