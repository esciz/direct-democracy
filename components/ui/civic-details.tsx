import type { ReactNode } from "react";

type CivicDetailsProps = {
  children: ReactNode;
  label?: string;
  className?: string;
};

export function CivicDetails({ children, label = "Details & sources", className = "" }: CivicDetailsProps) {
  return (
    <details className={`dd-civic-details ${className}`}>
      <summary>
        <span>{label}</span>
        <span aria-hidden="true" className="dd-civic-details-icon">+</span>
      </summary>
      <div className="dd-civic-details-content">{children}</div>
    </details>
  );
}

