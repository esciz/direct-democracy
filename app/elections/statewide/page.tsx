import { RaceGroupPage } from "@/app/elections/race-group-page";

export const dynamic = "force-dynamic";

export default function StatewideRacesPage() {
  return (
    <RaceGroupPage
      eyebrow="Statewide Races"
      title="Nevada statewide elections"
      description="Imported statewide Nevada election records and contests."
      filter={(election) => election.jurisdictionName === "Nevada"}
    />
  );
}
