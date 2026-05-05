"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  idleLabel: ReactNode;
  pendingLabel: ReactNode;
  disabled?: boolean;
  className?: string;
  name?: string;
  value?: string;
};

export function FormSubmitButton({
  idleLabel,
  pendingLabel,
  disabled = false,
  className,
  name,
  value,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={disabled || pending}
      className={className}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
