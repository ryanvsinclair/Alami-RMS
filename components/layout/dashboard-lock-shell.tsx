"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/nav/bottom-nav";
import { DashboardSideNav } from "@/components/nav/dashboard-side-nav";
import { PinKeypadModal } from "@/components/security/pin-keypad-modal";
import {
  APP_LOCK_CHANGED_EVENT,
  getAppLockPin,
  getAppLockState,
  getLockLandingPath,
  isPathAllowedWhileLocked,
  unlockApp,
  type AppLockState,
} from "@/shared/utils/app-lock";

function loadLockState() {
  return getAppLockState();
}

export function DashboardLockShell({
  enabledModules,
  children,
}: {
  enabledModules: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [lockState, setLockState] = useState<AppLockState>(loadLockState);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [unlockSession, setUnlockSession] = useState(0);

  const isLocked = lockState.locked && lockState.scope !== null;
  const lockScope = lockState.scope;

  const isPathAllowed = useMemo(() => {
    if (!isLocked || !lockScope) return true;
    return isPathAllowedWhileLocked(pathname, lockScope);
  }, [isLocked, lockScope, pathname]);

  useEffect(() => {
    function handleLockStateChange() {
      setLockState(loadLockState());
    }

    window.addEventListener(APP_LOCK_CHANGED_EVENT, handleLockStateChange);
    window.addEventListener("storage", handleLockStateChange);
    return () => {
      window.removeEventListener(APP_LOCK_CHANGED_EVENT, handleLockStateChange);
      window.removeEventListener("storage", handleLockStateChange);
    };
  }, []);

  useEffect(() => {
    if (!isLocked || !lockScope) return;

    if (!getAppLockPin()) {
      unlockApp();
      return;
    }

    if (!isPathAllowed) {
      router.replace(getLockLandingPath(lockScope));
    }
  }, [isLocked, isPathAllowed, lockScope, router]);

  function handleUnlockSubmit(pin: string) {
    const currentPin = getAppLockPin();
    if (!currentPin || pin !== currentPin) {
      setUnlockError("Incorrect PIN. Try again.");
      return;
    }
    unlockApp();
    setUnlockOpen(false);
    setUnlockError("");
  }

  if (isLocked) {
    if (!isPathAllowed) {
      return <div className="min-h-screen bg-background" />;
    }

    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="min-h-[100dvh]">{children}</div>
        <button
          type="button"
          onClick={() => {
            setUnlockError("");
            setUnlockSession((current) => current + 1);
            setUnlockOpen(true);
          }}
          className="fixed bottom-4 left-4 z-[80] rounded-xl border border-border bg-card/95 px-4 py-2 text-sm font-semibold text-foreground shadow-[var(--surface-card-shadow)] backdrop-blur-md"
        >
          Unlock
        </button>
        <PinKeypadModal
          key={`unlock:${unlockSession}`}
          open={unlockOpen}
          title="Unlock App"
          subtitle="Enter 4-digit PIN"
          error={unlockError}
          onSubmit={handleUnlockSubmit}
          onCancel={() => {
            setUnlockOpen(false);
            setUnlockError("");
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1920px]">
        <DashboardSideNav enabledModules={enabledModules} />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-24 md:pb-0">
          {children}
        </div>
      </div>
      <BottomNav enabledModules={enabledModules} />
    </div>
  );
}
