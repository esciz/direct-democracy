"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "civic-light";

const THEME_STORAGE_KEY = "dd-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "civic-light" ? "light" : "dark";

  const themeColor = document.querySelector('meta[name="theme-color"]');
  themeColor?.setAttribute("content", theme === "civic-light" ? "#f5f8fd" : "#0f172a");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme: Theme = storedTheme === "civic-light" ? "civic-light" : "dark";

    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "civic-light" : "dark";

    setTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  const isLight = theme === "civic-light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="dd-theme-toggle inline-flex min-h-10 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold"
      aria-label={`Switch to ${isLight ? "dark" : "light"} theme`}
      title={`Switch to ${isLight ? "dark" : "light"} theme`}
    >
      {isLight ? (
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
          <path d="M10 2.75v1.5M10 15.75v1.5M2.75 10h1.5M15.75 10h1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="m4.87 4.87 1.06 1.06m8.14 8.14 1.06 1.06m0-10.26-1.06 1.06m-8.14 8.14-1.06 1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="10" r="3.25" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
          <path
            d="M16.5 12.25A6.5 6.5 0 0 1 7.75 3.5a6.5 6.5 0 1 0 8.75 8.75Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span>{isLight ? "Light" : "Dark"}</span>
    </button>
  );
}
