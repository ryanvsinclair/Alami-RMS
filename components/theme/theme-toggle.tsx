"use client";

import { useEffect, useState } from "react";
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
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  const setMode = (next: ThemeMode) => {
    setTheme(next);
    applyTheme(next);
  };

  return (
    <div
      className="inline-flex rounded-2xl border border-border bg-card/70 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      role="tablist"
      aria-label="Color mode"
    >
      {([
        { id: "dark", label: "Dark" },
        { id: "light", label: "Light" },
      ] as const).map((option) => {
        const active = theme === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setMode(option.id)}
            className={`min-w-[78px] rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              active
                ? "bg-primary text-white shadow-[0_6px_14px_rgba(6,193,103,0.22)]"
                : "text-muted hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
