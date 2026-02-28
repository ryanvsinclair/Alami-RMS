"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-wide text-muted">Table Service Mode</p>
      <p className="mt-2 text-sm text-muted">
        Choose default workspace emphasis for launch operations.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant={mode === "host" ? "primary" : "secondary"}
          onClick={() => setWorkspaceMode("host")}
        >
          Host
        </Button>
        <Button
          variant={mode === "kitchen" ? "primary" : "secondary"}
          onClick={() => setWorkspaceMode("kitchen")}
        >
          Kitchen
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted">
        This launch toggle is temporary and will be replaced by role-based access in a future refactor.
      </p>
    </Card>
  );
}
