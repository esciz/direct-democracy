import Link from "next/link";

import { NotificationList } from "@/components/ui/notification-list";
import { getNotificationMenuSummary } from "@/lib/notifications/store";

type NotificationMenuProps = {
  userId: string;
};

export async function NotificationMenu({ userId }: NotificationMenuProps) {
  const { notifications, unreadCount } = await Promise.race([
    getNotificationMenuSummary(userId, 5),
    new Promise<{ notifications: []; unreadCount: number }>((resolve) => {
      setTimeout(() => resolve({ notifications: [], unreadCount: 0 }), 1200);
    }),
  ]).catch(() => ({ notifications: [], unreadCount: 0 }));

  return (
    <details className="group relative">
      <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
        <span className="relative inline-flex h-5 w-5 items-center justify-center">
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
            <path
              d="M10 3.5a4 4 0 0 0-4 4V9.4c0 .6-.2 1.18-.58 1.65L4 12.8h12l-1.42-1.75A2.62 2.62 0 0 1 14 9.4V7.5a4 4 0 0 0-4-4Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M8.25 14.5a1.75 1.75 0 0 0 3.5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <span className="sr-only">Notifications</span>
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-civic-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
            {unreadCount}
          </span>
        ) : null}
      </summary>
      <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[22rem] rounded-[1.5rem] border border-white/80 bg-white/96 p-4 shadow-card backdrop-blur">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Recent civic updates</p>
            <p className="mt-1 text-xs text-slate-500">
              Petition milestones, recommended debates, messaging updates, and follow-based civic updates appear here.
            </p>
          </div>
          <Link href="/notifications" className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
            View all
          </Link>
        </div>
        <NotificationList notifications={notifications} compact />
      </div>
    </details>
  );
}
