import { CommunityDiscoveryExplorer } from "@/components/domain/community-discovery-explorer";
import { PageIntro } from "@/components/ui/page-intro";
import { getCommunityPageHref, getNevadaCommunityKind, seededCommunities } from "@/lib/community/communities";
import type { CommunitySummary } from "@/types/domain";

type StateTile = {
  code: string;
  name: string;
  row: number;
  col: number;
};

const US_STATE_TILES: StateTile[] = [
  { code: "WA", name: "Washington", row: 1, col: 1 },
  { code: "MT", name: "Montana", row: 1, col: 3 },
  { code: "ND", name: "North Dakota", row: 1, col: 5 },
  { code: "MN", name: "Minnesota", row: 1, col: 7 },
  { code: "WI", name: "Wisconsin", row: 1, col: 8 },
  { code: "MI", name: "Michigan", row: 1, col: 9 },
  { code: "VT", name: "Vermont", row: 1, col: 11 },
  { code: "ME", name: "Maine", row: 1, col: 12 },
  { code: "OR", name: "Oregon", row: 2, col: 1 },
  { code: "ID", name: "Idaho", row: 2, col: 2 },
  { code: "WY", name: "Wyoming", row: 2, col: 3 },
  { code: "SD", name: "South Dakota", row: 2, col: 5 },
  { code: "IA", name: "Iowa", row: 2, col: 7 },
  { code: "IL", name: "Illinois", row: 2, col: 8 },
  { code: "IN", name: "Indiana", row: 2, col: 9 },
  { code: "OH", name: "Ohio", row: 2, col: 10 },
  { code: "NH", name: "New Hampshire", row: 2, col: 11 },
  { code: "CA", name: "California", row: 3, col: 1 },
  { code: "NV", name: "Nevada", row: 3, col: 2 },
  { code: "UT", name: "Utah", row: 3, col: 3 },
  { code: "CO", name: "Colorado", row: 3, col: 4 },
  { code: "NE", name: "Nebraska", row: 3, col: 5 },
  { code: "MO", name: "Missouri", row: 3, col: 7 },
  { code: "KY", name: "Kentucky", row: 3, col: 8 },
  { code: "WV", name: "West Virginia", row: 3, col: 9 },
  { code: "PA", name: "Pennsylvania", row: 3, col: 10 },
  { code: "NY", name: "New York", row: 3, col: 11 },
  { code: "MA", name: "Massachusetts", row: 3, col: 12 },
  { code: "AZ", name: "Arizona", row: 4, col: 2 },
  { code: "NM", name: "New Mexico", row: 4, col: 3 },
  { code: "KS", name: "Kansas", row: 4, col: 5 },
  { code: "AR", name: "Arkansas", row: 4, col: 7 },
  { code: "TN", name: "Tennessee", row: 4, col: 8 },
  { code: "VA", name: "Virginia", row: 4, col: 9 },
  { code: "NC", name: "North Carolina", row: 4, col: 10 },
  { code: "SC", name: "South Carolina", row: 4, col: 11 },
  { code: "OK", name: "Oklahoma", row: 5, col: 5 },
  { code: "LA", name: "Louisiana", row: 5, col: 7 },
  { code: "MS", name: "Mississippi", row: 5, col: 8 },
  { code: "AL", name: "Alabama", row: 5, col: 9 },
  { code: "GA", name: "Georgia", row: 5, col: 10 },
  { code: "FL", name: "Florida", row: 6, col: 11 },
  { code: "AK", name: "Alaska", row: 7, col: 1 },
  { code: "HI", name: "Hawaii", row: 7, col: 3 },
  { code: "TX", name: "Texas", row: 6, col: 5 },
  { code: "NJ", name: "New Jersey", row: 4, col: 12 },
  { code: "MD", name: "Maryland", row: 4, col: 12 },
  { code: "DE", name: "Delaware", row: 5, col: 12 },
  { code: "CT", name: "Connecticut", row: 4, col: 11 },
  { code: "RI", name: "Rhode Island", row: 4, col: 12 },
];

function getStateHref(code: string) {
  if (code === "NV") {
    return getCommunityPageHref("nevada");
  }

  return getCommunityPageHref("united-states");
}

function getSearchTypeLabel(community: CommunitySummary) {
  const kind = getNevadaCommunityKind(community.id);

  if (kind === "federal") return "USA" as const;
  if (community.scope === "state") return "State" as const;
  if (kind === "county") return "County" as const;
  if (kind === "community") return "Community" as const;
  if (community.scope === "local") return "City" as const;
  return "USA" as const;
}

function buildSearchResults() {
  const communityResults = seededCommunities.map((community) => ({
    id: community.id,
    label: community.name,
    typeLabel: getSearchTypeLabel(community),
    href: getCommunityPageHref(community.id),
    description: community.descriptor,
  }));

  return communityResults;
}

export default function CommunitiesPage() {
  const searchResults = buildSearchResults();
  const stateTiles = US_STATE_TILES.filter((state) => state.code === "NV").map((state) => ({
    ...state,
    href: getStateHref(state.code),
    hasDedicatedPage: true,
  }));

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Explore Communities"
        title="Find a Nevada community"
        description="Browse every Nevada county, incorporated city, and major community. Federal coverage appears as an overlay; other state-local expansion stays in the backlog."
      />

      <CommunityDiscoveryExplorer searchResults={searchResults} stateTiles={stateTiles} />
    </div>
  );
}
