"use client";

import { useState } from "react";

type BrandLogoProps = {
  size?: "sm" | "md" | "hero";
  darkSurface?: boolean;
  className?: string;
  framed?: boolean;
};

const LOGO_MARK_SRC = "/direct-democracy-logo-ballot-box-cropped.png";

const sizeClasses: Record<NonNullable<BrandLogoProps["size"]>, { frame: string; image: string; text: string }> = {
  sm: {
    frame: "h-12 w-[10.75rem] sm:h-16 sm:w-[14rem]",
    image: "h-full w-full object-contain object-center",
    text: "text-[0.7rem]",
  },
  md: {
    frame: "h-14 w-[12rem] sm:h-[4.5rem] sm:w-[15.5rem]",
    image: "h-full w-full object-contain object-center",
    text: "text-xs",
  },
  hero: {
    frame: "h-[6.4rem] w-[16.5rem]",
    image: "h-full w-full object-contain object-center",
    text: "text-base",
  },
};

export function BrandLogo({ size = "md", darkSurface = false, className, framed = false }: BrandLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const sizing = sizeClasses[size];

  return (
    <span
      className={[
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        framed
          ? `rounded-[1.2rem] border shadow-[0_10px_24px_-20px_rgba(15,23,42,0.6)] ${darkSurface ? "border-white/10 bg-white/95" : "border-slate-200 bg-white/92"}`
          : "bg-transparent shadow-none border-transparent",
        sizing.frame,
        className ?? "",
      ].join(" ")}
    >
      {!imageFailed ? (
        <img
          src={LOGO_MARK_SRC}
          alt="Direct Democracy logo"
          className={sizing.image}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span
          aria-label="Direct Democracy"
          className={`px-3 text-center font-semibold tracking-[0.08em] whitespace-nowrap ${darkSurface ? "text-slate-950" : "text-slate-900"} ${sizing.text}`}
        >
          Direct Democracy
        </span>
      )}
    </span>
  );
}

export { BrandLogo as Logo };
