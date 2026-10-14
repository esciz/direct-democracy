import { PetitionCard } from "@/components/domain/petition-card";
import type { PetitionSummary } from "@/types/domain";

type PetitionListProps = {
  petitions: PetitionSummary[];
};

export function PetitionList({ petitions }: PetitionListProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {petitions.map((petition) => (
        <PetitionCard key={petition.id} petition={petition} />
      ))}
    </div>
  );
}
