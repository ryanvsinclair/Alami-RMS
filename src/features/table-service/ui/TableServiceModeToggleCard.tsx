"use client";

import { useState } from "react";
import {
  TABLE_SERVICE_WORKSPACE_MODES,
  TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY,
  type TableServiceWorkspaceMode,
} from "@/features/table-service/shared";

const DEFAULT_MODE: TableServiceWorkspaceMode = "host";

function isTableServiceMode(value: string | null): value is TableServiceWorkspaceMode {
  return (
    value !== null &&
    TABLE_SERVICE_WORKSPACE_MODES.includes(value as TableServiceWorkspaceMode)
  );
}

export default function TableServiceModeToggleCard() {
  const [mode, setMode] = useState<TableServiceWorkspaceMode>(() => {
    if (typeof window === "undefined") return DEFAULT_MODE;
    const stored = window.localStorage.getItem(TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY);
    return isTableServiceMode(stored) ? stored : DEFAULT_MODE;
  });

  function setWorkspaceMode(nextMode: TableServiceWorkspaceMode) {
    setMode(nextMode);
    window.localStorage.setItem(TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY, nextMode);
  }

  const isKitchen = mode === "kitchen";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Kitchen Mode</p>
          <p className="text-xs text-muted">
            {isKitchen ? "On (Kitchen)" : "Off (Host)"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isKitchen}
          aria-label={`Workspace mode: ${isKitchen ? "Kitchen" : "Host"}`}
          onClick={() => setWorkspaceMode(isKitchen ? "host" : "kitchen")}
          className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
            isKitchen
              ? "border-primary/45 bg-primary/65"
              : "border-border bg-foreground/10"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              isKitchen ? "translate-x-[1.25rem]" : "translate-x-[0.1rem]"
            }`}
          />
        </button>
      </div>
      <p className="text-xs text-muted">
        This launch toggle is temporary and will be replaced by role-based access in a future refactor.
      </p>
    </div>
  );
}
