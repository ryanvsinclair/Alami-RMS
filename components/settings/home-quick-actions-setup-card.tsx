"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useBusinessConfig } from "@/lib/config/context";
import {
  HOME_QUICK_ACTION_SLOT_COUNT,
  getAvailableHomeQuickActions,
  getHomeQuickActionSnapshotKey,
  parseHomeQuickActionSnapshotKey,
  setStoredHomeQuickActionIds,
  subscribeToHomeQuickActions,
  type HomeQuickActionAvailabilityContext,
  type HomeQuickActionId,
} from "@/shared/utils/home-quick-actions";

function cx(...classes: Array<string | false>) {
  return classes.filter(Boolean).join(" ");
}

export function HomeQuickActionsSetupCard() {
  const { enabledModules, industryType } = useBusinessConfig();

  const availabilityContext = useMemo<HomeQuickActionAvailabilityContext>(
    () => ({
      enabledModules,
      industryType,
    }),
    [enabledModules, industryType],
  );

  const availableActions = useMemo(
    () => getAvailableHomeQuickActions(availabilityContext),
    [availabilityContext],
  );

  const selectedActionSnapshotKey = useSyncExternalStore(
    subscribeToHomeQuickActions,
    () => getHomeQuickActionSnapshotKey(availabilityContext),
    () => getHomeQuickActionSnapshotKey(availabilityContext),
  );

  const selectedActionIds = useMemo(
    () => parseHomeQuickActionSnapshotKey(selectedActionSnapshotKey, availabilityContext),
    [selectedActionSnapshotKey, availabilityContext],
  );

  function handleSlotChange(slotIndex: number, nextActionId: HomeQuickActionId) {
    const nextSelection = [...selectedActionIds];
    const previousActionId = nextSelection[slotIndex];
    if (previousActionId === nextActionId) return;

    const existingIndex = nextSelection.findIndex(
      (actionId, idx) => idx !== slotIndex && actionId === nextActionId,
    );

    if (existingIndex >= 0) {
      nextSelection[existingIndex] = previousActionId;
    }

    nextSelection[slotIndex] = nextActionId;
    setStoredHomeQuickActionIds(nextSelection, availabilityContext);
  }

  function resetDefaults() {
    const defaults = parseHomeQuickActionSnapshotKey("", availabilityContext);
    setStoredHomeQuickActionIds(defaults, availabilityContext);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Home Quick Actions</p>
          <p className="text-xs text-muted">
            Choose the 4 shortcuts shown on the home quick-action row.
          </p>
        </div>
        <button
          type="button"
          onClick={resetDefaults}
          className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/[0.05]"
        >
          Reset
        </button>
      </div>

      <div className="grid gap-2">
        {Array.from({ length: HOME_QUICK_ACTION_SLOT_COUNT }).map((_, index) => {
          const selectedId = selectedActionIds[index];
          const takenByOtherSlots = new Set(
            selectedActionIds.filter((id, takenIndex) => takenIndex !== index && id),
          );
          const slotOptions = availableActions.filter(
            (action) => action.id === selectedId || !takenByOtherSlots.has(action.id),
          );

          return (
            <label key={`quick-action-slot-${index}`} className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Slot {index + 1}
              </span>
              <select
                value={selectedId}
                onChange={(event) => handleSlotChange(index, event.target.value as HomeQuickActionId)}
                className={cx(
                  "h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground",
                  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
                )}
              >
                {slotOptions.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </section>
  );
}
