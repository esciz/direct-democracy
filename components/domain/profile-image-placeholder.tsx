"use client";

import { CivicAvatar } from "@/components/domain/civic-avatar";

type ProfileImagePlaceholderProps = {
  name: string;
  size?: "sm" | "lg";
  imageUrl?: string | null;
};

export function ProfileImagePlaceholder({ name, size = "sm", imageUrl }: ProfileImagePlaceholderProps) {
  return (
    <CivicAvatar
      name={name}
      imageUrl={imageUrl}
      entityType="citizen"
      verified
      size={size === "lg" ? "lg" : "md"}
      className={size === "lg" ? "h-28 w-28 text-3xl" : "h-14 w-14 text-lg"}
    />
  );
}
