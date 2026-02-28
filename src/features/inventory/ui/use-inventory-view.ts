"use client";

import { useEffect, useMemo, useState } from "react";
import type { InventorySortKey } from "@/shared/ui/sort-select";
import type { InventoryViewMode } from "@/shared/ui/view-mode-toggle";

const STORAGE_KEY = "inventory_view_preferences_v1";

type InventoryViewPreferences = {
  viewMode: InventoryViewMode;
  sortKey: InventorySortKey;
  categoryFilter: string | null;
};

const DEFAULT_PREFERENCES: InventoryViewPreferences = {
  viewMode: "grid",
  sortKey: "name_asc",
  categoryFilter: null,
};

function isValidViewMode(value: unknown): value is InventoryViewMode {
  return value === "grid" || value === "list";
}

function isValidSortKey(value: unknown): value is InventorySortKey {
  return (
    value === "name_asc" ||
    value === "name_desc" ||
    value === "qty_asc" ||
    value === "qty_desc" ||
    value === "low_stock" ||
    value === "last_updated"
  );
}

function loadPreferences(): InventoryViewPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<InventoryViewPreferences>;
    return {
      viewMode: isValidViewMode(parsed.viewMode) ? parsed.viewMode : DEFAULT_PREFERENCES.viewMode,
      sortKey: isValidSortKey(parsed.sortKey) ? parsed.sortKey : DEFAULT_PREFERENCES.sortKey,
      categoryFilter:
        typeof parsed.categoryFilter === "string" ? parsed.categoryFilter : DEFAULT_PREFERENCES.categoryFilter,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function useInventoryView() {
  const [preferences, setPreferences] = useState<InventoryViewPreferences>(() => loadPreferences());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore localStorage failures.
    }
  }, [preferences]);

  const controls = useMemo(
    () => ({
      setViewMode: (viewMode: InventoryViewMode) =>
        setPreferences((current) => ({
          ...current,
          viewMode,
        })),
      setSortKey: (sortKey: InventorySortKey) =>
        setPreferences((current) => ({
          ...current,
          sortKey,
        })),
      setCategoryFilter: (categoryFilter: string | null) =>
        setPreferences((current) => ({
          ...current,
          categoryFilter,
        })),
    }),
    [],
  );

  return {
    viewMode: preferences.viewMode,
    setViewMode: controls.setViewMode,
    sortKey: preferences.sortKey,
    setSortKey: controls.setSortKey,
    categoryFilter: preferences.categoryFilter,
    setCategoryFilter: controls.setCategoryFilter,
  };
}
