import { redirect } from "next/navigation";

import { PollCreateForm } from "@/components/domain/poll-create-form";
import { canUserCreatePoll } from "@/lib/server/auth-guards";
import { getRoleLabel } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/server/auth-session";

type CreatePollPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function CreatePollPage({ searchParams }: CreatePollPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;

  if (!(await canUserCreatePoll(user))) {
    redirect("/polls?denied=create-poll");
  }

  return (
    <div className="space-y-6 py-8">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Polls</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Create a citizen poll</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Polls are contextual by default. Tie the question to a real community, issue, person, election, petition, or coalition so the result shows up where it belongs.
        </p>
      </section>

      <PollCreateForm
        roleLabel={getRoleLabel(user.role)}
        jurisdictionName={user.jurisdictionName}
        defaultJurisdictionId={user.primaryCommunityId ?? null}
        error={params?.error}
      />
    </div>
  );
}
