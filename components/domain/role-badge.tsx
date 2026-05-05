import type { UserRole } from "@/types/domain";

import { getRoleLabel } from "@/lib/auth/roles";
import {
  BallotBoxIcon,
  EndorsementSealIcon,
  IssueSparkIcon,
  MessageStreamIcon,
  PulseBoltIcon,
  TrustShieldIcon,
} from "@/components/ui/action-icons";

type RoleBadgeProps = {
  role: UserRole;
};

const roleStyles: Record<UserRole, string> = {
  citizen: "border border-slate-200 bg-[linear-gradient(145deg,rgba(248,250,252,0.96),rgba(255,255,255,0.95))] text-slate-700",
  trustedCitizen: "border border-civic-200 bg-[linear-gradient(145deg,rgba(224,242,254,0.96),rgba(239,246,255,0.95))] text-civic-800",
  candidate: "border border-emerald-200 bg-[linear-gradient(145deg,rgba(209,250,229,0.96),rgba(236,253,245,0.95))] text-emerald-800",
  official: "border border-slate-800 bg-[linear-gradient(145deg,rgba(15,23,42,1),rgba(30,41,59,0.95))] text-white",
  media: "border border-sky-200 bg-[linear-gradient(145deg,rgba(224,242,254,0.96),rgba(240,249,255,0.95))] text-sky-800",
  moderator: "border border-orange-200 bg-[linear-gradient(145deg,rgba(255,237,213,0.96),rgba(255,247,237,0.95))] text-orange-800",
  admin: "border border-violet-200 bg-[linear-gradient(145deg,rgba(237,233,254,0.96),rgba(245,243,255,0.95))] text-violet-800",
};

const roleIcons: Record<UserRole, typeof PulseBoltIcon> = {
  citizen: PulseBoltIcon,
  trustedCitizen: TrustShieldIcon,
  candidate: EndorsementSealIcon,
  official: BallotBoxIcon,
  media: MessageStreamIcon,
  moderator: IssueSparkIcon,
  admin: TrustShieldIcon,
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const Icon = roleIcons[role];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] shadow-[0_8px_24px_-20px_rgba(15,23,42,0.9)] ${roleStyles[role]}`}>
      <Icon className="h-3.5 w-3.5" />
      {getRoleLabel(role)}
    </span>
  );
}
