"use client";

import { useRouter } from "next/navigation";
import type { FormHTMLAttributes, ReactNode } from "react";

type PreserveScrollQueryFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "children"> & {
  action: string;
  children: ReactNode;
};

export function PreserveScrollQueryForm({
  action,
  children,
  onSubmit,
  ...props
}: PreserveScrollQueryFormProps) {
  const router = useRouter();

  function handleSubmit(event: Parameters<NonNullable<FormHTMLAttributes<HTMLFormElement>["onSubmit"]>>[0]) {
    onSubmit?.(event);

    if (event.defaultPrevented) {
      return;
    }

    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const params = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string") {
        continue;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }

      params.append(key, trimmed);
    }

    const href = params.size ? `${action}?${params.toString()}` : action;
    router.push(href, { scroll: false });
  }

  return (
    <form {...props} action={action} onSubmit={handleSubmit}>
      {children}
    </form>
  );
}
