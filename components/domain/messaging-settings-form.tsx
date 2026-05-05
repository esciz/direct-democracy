import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { updateMessagingAudienceRule } from "@/lib/messages/actions";
import type { PublicFigureMessagingSettingsSummary } from "@/types/domain";

type MessagingSettingsFormProps = {
  settings: PublicFigureMessagingSettingsSummary;
};

export function MessagingSettingsForm({ settings }: MessagingSettingsFormProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Messaging settings</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Who can send you a first message</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        First-time messages always land in requests. You can accept, ignore, block, or report before replying.
      </p>
      <form action={updateMessagingAudienceRule} className="mt-5 space-y-4">
        <select
          name="audienceRule"
          defaultValue={settings.audienceRule}
          className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
        >
          <option value="everyone">Everyone (request-based)</option>
          <option value="followersOnly">Followers only</option>
          <option value="jurisdictionOnly">People in my jurisdiction only</option>
        </select>
        <FormSubmitButton
          idleLabel="Save messaging setting"
          pendingLabel="Saving..."
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        />
      </form>
    </section>
  );
}
