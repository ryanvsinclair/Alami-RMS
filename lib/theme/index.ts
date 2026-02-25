export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "alamirms-theme";
export const DEFAULT_THEME: ThemeMode = "dark";

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "dark" || value === "light";
}
