"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { PinKeypadModal } from "./pin-keypad-modal";
import {
  APP_LOCK_CHANGED_EVENT,
  clearAppLockPin,
  getAppLockPin,
  hasAppLockPin,
  setAppLockPin,
} from "@/shared/utils/app-lock";

type PinFlowStep = "enter_old" | "enter_new" | "confirm_new" | "confirm_remove";
type PinFlowMode = "set" | "change" | "remove";

function resolveInitialStep(mode: PinFlowMode, alreadyHasPin: boolean): PinFlowStep {
  if (mode === "set") return alreadyHasPin ? "enter_old" : "enter_new";
  if (mode === "change") return "enter_old";
  return "confirm_remove";
}

function getStepTitle(mode: PinFlowMode, step: PinFlowStep) {
  if (mode === "remove") return "Remove Passcode";
  if (step === "enter_old") return "Change Passcode";
  return "Set Passcode";
}

function getStepSubtitle(mode: PinFlowMode, step: PinFlowStep) {
  if (mode === "remove") return "Enter current 4-digit PIN";
  if (step === "enter_old") return "Enter current 4-digit PIN";
  if (step === "enter_new") return "Enter new 4-digit PIN";
  return "Re-enter new 4-digit PIN";
}

function subscribeToPinStatus(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(APP_LOCK_CHANGED_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(APP_LOCK_CHANGED_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getPinStatusSnapshot() {
  return hasAppLockPin();
}

function getPinStatusServerSnapshot() {
  return false;
}

export function AppLockPinCard() {
  const pinExists = useSyncExternalStore(
    subscribeToPinStatus,
    getPinStatusSnapshot,
    getPinStatusServerSnapshot,
  );
  const [open, setOpen] = useState(false);
  const [flowSession, setFlowSession] = useState(0);
  const [mode, setMode] = useState<PinFlowMode>("set");
  const [step, setStep] = useState<PinFlowStep>("enter_new");
  const [draftNewPin, setDraftNewPin] = useState<string | null>(null);
  const [error, setError] = useState("");

  const stepKey = useMemo(() => `${mode}:${step}`, [mode, step]);

  function openFlow(nextMode: PinFlowMode) {
    const existing = hasAppLockPin();
    setFlowSession((current) => current + 1);
    setMode(nextMode);
    setStep(resolveInitialStep(nextMode, existing));
    setDraftNewPin(null);
    setError("");
    setOpen(true);
  }

  function closeFlow() {
    setOpen(false);
    setDraftNewPin(null);
    setError("");
    setStep("enter_new");
    setMode("set");
  }

  function onPinSubmit(pin: string) {
    const currentPin = getAppLockPin();

    if (mode === "remove") {
      if (pin !== currentPin) {
        setError("Incorrect PIN. Try again.");
        return;
      }
      clearAppLockPin();
      closeFlow();
      return;
    }

    if (step === "enter_old") {
      if (pin !== currentPin) {
        setError("Incorrect PIN. Try again.");
        return;
      }
      setError("");
      setStep("enter_new");
      return;
    }

    if (step === "enter_new") {
      setDraftNewPin(pin);
      setError("");
      setStep("confirm_new");
      return;
    }

    if (step === "confirm_new") {
      if (!draftNewPin || pin !== draftNewPin) {
        setError("PINs did not match. Enter new PIN again.");
        setDraftNewPin(null);
        setStep("enter_new");
        return;
      }

      setAppLockPin(pin);
      closeFlow();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">App Lock PIN</p>
          <p className="text-xs text-muted">
            {pinExists ? "4-digit PIN configured" : "Set a 4-digit PIN for lock mode"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openFlow(pinExists ? "change" : "set")}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/[0.05]"
          >
            {pinExists ? "Change PIN" : "Set PIN"}
          </button>
          {pinExists && (
            <button
              type="button"
              onClick={() => openFlow("remove")}
              className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/10"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <PinKeypadModal
        key={`flow:${flowSession}:${stepKey}`}
        open={open}
        title={getStepTitle(mode, step)}
        subtitle={getStepSubtitle(mode, step)}
        error={error}
        onSubmit={onPinSubmit}
        onCancel={closeFlow}
      />
    </div>
  );
}
