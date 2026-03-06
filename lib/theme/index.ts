export type ThemeMode = "light";

export const THEME_STORAGE_KEY = "vynance-theme";
export const DEFAULT_THEME: ThemeMode = "light";

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "light";
}
