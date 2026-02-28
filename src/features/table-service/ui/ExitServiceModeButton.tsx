"use client";

import { useRouter } from "next/navigation";
import { TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY } from "@/features/table-service/shared";

/**
 * Clears the table-service workspace mode from localStorage and navigates home.
 * Shown in kitchen and host workspace headers so staff can exit back to the main app.
 */
export function ExitServiceModeButton() {
  const router = useRouter();

  function handleExit() {
    try {
      window.localStorage.removeItem(TABLE_SERVICE_WORKSPACE_MODE_STORAGE_KEY);
    } catch {
      // Ignore storage failures and still route out of workspace mode.
    }
    router.replace("/");
  }

  return (
    <button
      type="button"
      aria-label="Exit service mode and return to home"
      onClick={handleExit}
      className="flex items-center gap-1.5 whitespace-nowrap rounded-2xl border border-border bg-foreground/[0.04] px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-foreground/20 hover:text-foreground"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-3.5 w-3.5"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
        />
      </svg>
      Exit to App
    </button>
  );
}
