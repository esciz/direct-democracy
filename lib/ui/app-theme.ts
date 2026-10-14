export type AppTheme = "dark" | "civic-light";

export const APP_THEME_STORAGE_KEY = "dd-theme";

export function applyAppTheme(theme: AppTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "civic-light" ? "light" : "dark";

  const themeColor = document.querySelector('meta[name="theme-color"]');
  themeColor?.setAttribute("content", theme === "civic-light" ? "#f8fafc" : "#0f172a");
}
