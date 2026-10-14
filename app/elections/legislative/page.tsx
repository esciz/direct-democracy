import { RaceGroupPage } from "@/app/elections/race-group-page";

export const dynamic = "force-dynamic";

export default function LegislativeRacesPage() {
  return (
    <RaceGroupPage
      eyebrow="Legislative Races"
      title="Nevada legislative election records"
      description="Imported legislative race records when available in the Nevada beta election data."
      filter={(election) => /legislature|assembly|senate/i.test(`${election.title} ${election.officeTitle}`)}
    />
  );
}
