import { getCivicJurisdictionTag } from "@/lib/civic/jurisdiction-context";

type JurisdictionTagProps = {
  jurisdictionName: string;
  bodyName?: string | null;
  className?: string;
};

export function JurisdictionTag({ jurisdictionName, bodyName, className = "" }: JurisdictionTagProps) {
  return (
    <span className={`inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ${className}`.trim()}>
      {getCivicJurisdictionTag({ jurisdictionName, bodyName })}
    </span>
  );
}
