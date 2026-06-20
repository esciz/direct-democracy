import Image from "next/image";

import type { CommunityHeroSummary } from "@/types/domain";

type CommunityHeroProps = {
  community: CommunityHeroSummary;
};

export function CommunityHero({ community }: CommunityHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] shadow-card">
      <div className="relative aspect-[16/9] min-h-[260px] w-full sm:aspect-[16/8] lg:aspect-[16/7]">
        <Image
          src={community.imagePath}
          alt={community.name}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-slate-950/10" />
      <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            Community spotlight
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{community.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">{community.descriptor}</p>
        </div>
      </div>
    </section>
  );
}
