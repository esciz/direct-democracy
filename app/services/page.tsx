import Link from "next/link";

import { CommunitySelector } from "@/components/domain/community-selector";
import { ServiceCard } from "@/components/domain/service-card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageIntro } from "@/components/ui/page-intro";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCommunityById, getDefaultCommunityForUser } from "@/lib/community/communities";
import { getServiceCategories, getServicesForCommunity } from "@/lib/services/store";
import type { ServiceCategory } from "@/types/domain";

type ServicesPageProps = {
  searchParams?: Promise<{
    communityId?: string;
    category?: string;
  }>;
};

function normalizeCategory(category: string | undefined): ServiceCategory | "all" {
  const categories = getServiceCategories();
  return categories.includes(category as ServiceCategory) ? (category as ServiceCategory) : "all";
}

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const defaultCommunity = getDefaultCommunityForUser(user);
  const selectedCommunityId = params?.communityId ?? defaultCommunity.id;
  const currentCommunity = getCommunityById(selectedCommunityId) ?? defaultCommunity;
  const selectedCategory = normalizeCategory(params?.category);
  const [services] = await Promise.all([
    Promise.resolve(getServicesForCommunity(selectedCommunityId, selectedCategory)),
  ]);

  const categories = getServiceCategories();
  const categoryTabs = [
    {
      label: "All services",
      href: `/services?communityId=${selectedCommunityId}`,
      active: selectedCategory === "all",
    },
    ...categories.map((category) => ({
      label: category,
      href: `/services?communityId=${selectedCommunityId}&category=${encodeURIComponent(category)}`,
      active: selectedCategory === category,
    })),
  ];

  const groupedServices = categories.map((category) => ({
    category,
    services: services.filter((service) => service.category === category),
  }));

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Services"
        title={`Get things done in ${currentCommunity.name}`}
        description="A fast, community-based directory for common government-related tasks, routed to the right external resources and the people responsible for them."
        actions={
          <Link
            href={`/my-community?communityId=${selectedCommunityId}`}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to My Community
          </Link>
        }
      />

      <CommunitySelector
        currentCommunity={currentCommunity}
        followedCommunities={[]}
        suggestedCommunities={[]}
        followedIds={[]}
        returnPath="/services"
        destinationBase="/services"
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Categories</p>
            <p className="mt-2 text-sm text-slate-600">Browse common civic tasks by area so the right service is easy to spot.</p>
          </div>
          <FilterTabs tabs={categoryTabs} />
        </div>
      </section>

      {groupedServices.map((group) =>
        group.services.length ? (
          <section key={group.category} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
            <SectionHeading
              eyebrow={group.category}
              title={`${group.category} services`}
              description="External service links and lightweight responsibility context. Direct Democracy helps route you there, but does not process the request internally."
            />
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {group.services.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          </section>
        ) : null,
      )}

      {!services.length ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 text-sm text-slate-600 shadow-card backdrop-blur">
          No services are seeded for this community view yet.
        </section>
      ) : null}
    </div>
  );
}
