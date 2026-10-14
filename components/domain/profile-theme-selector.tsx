"use client";

import { useEffect } from "react";

import { APP_THEME_STORAGE_KEY, applyAppTheme } from "@/lib/ui/app-theme";
import type { UserProfileContentSummary } from "@/types/domain";

type ProfileTheme = NonNullable<UserProfileContentSummary["profileTheme"]>;

type ProfileThemeSelectorProps = {
  selectedTheme: ProfileTheme;
};

const THEME_OPTIONS: Array<{
  value: ProfileTheme;
  title: string;
  description: string;
  selectedClasses: string;
  colors: string[];
}> = [
  {
    value: "classic",
    title: "Classic civic",
    description: "Calm, dark, and focused",
    selectedClasses: "peer-checked:border-cyan-300/60 peer-checked:bg-cyan-300/[0.07]",
    colors: ["bg-[#07111f]", "bg-cyan-300", "bg-emerald-300", "bg-amber-200"],
  },
  {
    value: "bright",
    title: "Bright civic",
    description: "Dark with energetic color",
    selectedClasses: "peer-checked:border-[#ff8a70] peer-checked:bg-[#ff8a70]/[0.08]",
    colors: ["bg-[#ff8a70]", "bg-[#54d6d0]", "bg-[#b9f66b]", "bg-[#ffd166]"],
  },
  {
    value: "daylight",
    title: "Civic daylight",
    description: "White surfaces and dark text",
    selectedClasses: "peer-checked:border-[#1f5ea8] peer-checked:bg-[#1f5ea8]/[0.08]",
    colors: ["bg-white", "bg-[#1f5ea8]", "bg-[#c72f45]", "bg-[#e66b24]"],
  },
];

export function ProfileThemeSelector({ selectedTheme }: ProfileThemeSelectorProps) {
  useEffect(() => {
    if (selectedTheme === "daylight") {
      window.localStorage.setItem(APP_THEME_STORAGE_KEY, "civic-light");
      applyAppTheme("civic-light");
    }
  }, [selectedTheme]);

  function handleThemeChange(theme: ProfileTheme) {
    const appTheme = theme === "daylight" ? "civic-light" : "dark";

    window.localStorage.setItem(APP_THEME_STORAGE_KEY, appTheme);
    applyAppTheme(appTheme);
  }

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3" aria-labelledby="profile-color-heading">
      {THEME_OPTIONS.map((option) => (
        <label key={option.value} className="cursor-pointer">
          <input
            type="radio"
            name="profileTheme"
            value={option.value}
            defaultChecked={selectedTheme === option.value}
            onChange={() => handleThemeChange(option.value)}
            className="dd-theme-choice-input peer sr-only"
          />
          <span
            className={`dd-theme-choice flex min-h-24 items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 transition ${option.selectedClasses}`}
          >
            <span>
              <span className="block text-sm font-semibold text-slate-100">{option.title}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-400">{option.description}</span>
            </span>
            <span className="grid shrink-0 grid-cols-2 gap-1" aria-hidden="true">
              {option.colors.map((color) => (
                <span key={color} className={`h-5 w-5 rounded border border-slate-400/20 ${color}`} />
              ))}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
