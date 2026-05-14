import { CivicAvatar } from "@/components/domain/civic-avatar";

type AvatarStackItem = {
  id: string;
  name?: string | null;
  imageUrl?: string | null;
  entityType?:
    | "citizen"
    | "trustedCitizen"
    | "candidate"
    | "official"
    | "organization"
    | "media"
    | "community"
    | "agency"
    | "case"
    | "publicAccountability"
    | "petition"
    | "issue";
  verified?: boolean;
};

type AvatarStackProps = {
  items: AvatarStackItem[];
  size?: "xs" | "sm" | "md";
  max?: number;
};

export function AvatarStack({ items, size = "xs", max = 3 }: AvatarStackProps) {
  const visible = items.slice(0, max);
  const remainder = Math.max(0, items.length - max);

  if (!visible.length) {
    return null;
  }

  return (
    <div className="flex items-center">
      {visible.map((item, index) => (
        <div key={item.id} className={index === 0 ? "" : "-ml-2"}>
          <CivicAvatar
            name={item.name}
            imageUrl={item.imageUrl}
            entityType={item.entityType}
            verified={item.verified}
            size={size}
            title={item.name ?? undefined}
            className="border-slate-950 ring-white/15"
          />
        </div>
      ))}
      {remainder ? (
        <div className="-ml-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/12 bg-slate-900 text-[10px] font-semibold text-slate-200 ring-1 ring-white/10">
          +{remainder}
        </div>
      ) : null}
    </div>
  );
}
