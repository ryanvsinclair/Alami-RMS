"use client";

import { useState } from "react";
import {
  DEFAULT_THEME,
  isThemeMode,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "@/lib/theme";

function readTheme(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(stored) ? stored : DEFAULT_THEME;
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => readTheme());

  const setMode = (next: ThemeMode) => {
    setTheme(next);
    applyTheme(next);
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={`Color mode: ${isDark ? "Dark" : "Light"}`}
      onClick={() => setMode(isDark ? "light" : "dark")}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
        isDark
          ? "border-primary/45 bg-primary/65"
          : "border-border bg-foreground/10"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          isDark ? "translate-x-[1.25rem]" : "translate-x-[0.1rem]"
        }`}
      />
    </button>
  );
}
