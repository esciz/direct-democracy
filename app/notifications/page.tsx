import { NotificationList } from "@/components/ui/notification-list";
import { PageIntro } from "@/components/ui/page-intro";
import { markAllNotificationsReadAction } from "@/lib/notifications/actions";
import { getNotificationPreferences } from "@/lib/notifications/preferences";
import { updateNotificationPreferencesAction } from "@/lib/notifications/preferences-actions";
import { getNotificationsForUser, getUnreadNotificationCount } from "@/lib/notifications/store";
import { getCurrentUser } from "@/lib/server/auth-session";

type NotificationsPageProps = {
  searchParams?: Promise<{
    preferences?: string;
  }>;
};

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const [notifications, unreadCount, preferences] = await Promise.all([
    getNotificationsForUser(user.id),
    getUnreadNotificationCount(user.id),
    getNotificationPreferences(user.id),
  ]);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Notifications"
        title="Civic activity updates"
        description="Track petition progress, new posts from people you follow, major civic actions, and recommended debates that fit your issue priorities."
        meta={
          <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
            {unreadCount} unread
          </span>
        }
        actions={
          unreadCount ? (
            <form action={markAllNotificationsReadAction}>
              <button
                type="submit"
                className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              >
                Mark all read
              </button>
            </form>
          ) : null
        }
      />

      {params?.preferences === "updated" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Notification preferences updated.
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Follow-based notifications</h2>
        <p className="mt-2 text-sm text-slate-600">Choose whether followed people trigger updates for new posts, major civic actions, or both.</p>
        <form action={updateNotificationPreferencesAction} className="mt-5 grid gap-4">
          <label className="flex items-center gap-3 rounded-3xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <input type="checkbox" name="posts" defaultChecked={preferences.posts} className="h-4 w-4 rounded border-slate-300" />
            Notify me when people I follow create posts
          </label>
          <label className="flex items-center gap-3 rounded-3xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <input type="checkbox" name="majorActions" defaultChecked={preferences.majorActions} className="h-4 w-4 rounded border-slate-300" />
            Notify me when people I follow take major civic actions
          </label>
          <button
            type="submit"
            className="w-fit rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Save notification settings
          </button>
        </form>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <NotificationList notifications={notifications} />
      </section>
    </div>
  );
}
