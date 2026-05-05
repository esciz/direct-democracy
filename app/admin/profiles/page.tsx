import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPublicProfileForm } from "@/components/domain/admin-public-profile-form";
import { PageIntro } from "@/components/ui/page-intro";
import { getAdminProfileFormOptions } from "@/lib/admin/actions";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getAdminManagedProfiles } from "@/lib/server/elections-context";

type AdminProfilesPageProps = {
  searchParams?: Promise<{
    error?: string;
    created?: string;
  }>;
};

export default async function AdminProfilesPage({ searchParams }: AdminProfilesPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const options = await getAdminProfileFormOptions();
  const profiles = await getAdminManagedProfiles();

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Manage public profiles"
        description="Create unclaimed candidate and official profiles so elections and directories can be populated before people join the platform."
        actions={
          <Link
            href="/profile"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to profile
          </Link>
        }
      />
      <AdminPublicProfileForm
        electionOptions={options.elections}
        profiles={profiles}
        error={params?.error}
        created={params?.created}
      />
    </div>
  );
}
