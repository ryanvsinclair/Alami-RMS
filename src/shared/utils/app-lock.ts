"use client";

export type AppLockScope = "table" | "kitchen";

export type AppLockState = {
  locked: boolean;
  scope: AppLockScope | null;
};

export const APP_LOCK_PIN_STORAGE_KEY = "app_lock_pin_v1";
export const APP_LOCK_STATE_STORAGE_KEY = "app_lock_state_v1";
export const APP_LOCK_CHANGED_EVENT = "app-lock-changed";

const DEFAULT_APP_LOCK_STATE: AppLockState = {
  locked: false,
  scope: null,
};

const APP_LOCK_ALLOWED_PREFIXES: Record<AppLockScope, string[]> = {
  table: ["/service/table", "/service/tables", "/service/host"],
  kitchen: ["/service/kitchen"],
};

function notifyAppLockChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(APP_LOCK_CHANGED_EVENT));
}

function isAppLockScope(value: unknown): value is AppLockScope {
  return value === "table" || value === "kitchen";
}

function isValidPin(value: string) {
  return /^\d{4}$/.test(value);
}

export function getAppLockPin() {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(APP_LOCK_PIN_STORAGE_KEY);
  if (!stored || !isValidPin(stored)) return null;
  return stored;
}

export function hasAppLockPin() {
  return getAppLockPin() !== null;
}

export function setAppLockPin(pin: string) {
  if (typeof window === "undefined") return;
  if (!isValidPin(pin)) {
    throw new Error("PIN must be exactly 4 digits.");
  }
  window.localStorage.setItem(APP_LOCK_PIN_STORAGE_KEY, pin);
  notifyAppLockChange();
}

export function clearAppLockPin() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(APP_LOCK_PIN_STORAGE_KEY);
  unlockApp();
  notifyAppLockChange();
}

export function getAppLockState(): AppLockState {
  if (typeof window === "undefined") return DEFAULT_APP_LOCK_STATE;
  const stored = window.localStorage.getItem(APP_LOCK_STATE_STORAGE_KEY);
  if (!stored) return DEFAULT_APP_LOCK_STATE;

  try {
    const parsed = JSON.parse(stored) as Partial<AppLockState>;
    if (parsed.locked === true && isAppLockScope(parsed.scope)) {
      return { locked: true, scope: parsed.scope };
    }
  } catch {
    return DEFAULT_APP_LOCK_STATE;
  }

  return DEFAULT_APP_LOCK_STATE;
}

function setAppLockState(nextState: AppLockState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APP_LOCK_STATE_STORAGE_KEY, JSON.stringify(nextState));
  notifyAppLockChange();
}

export function lockAppToScope(scope: AppLockScope) {
  setAppLockState({ locked: true, scope });
}

export function unlockApp() {
  setAppLockState(DEFAULT_APP_LOCK_STATE);
}

export function getLockLandingPath(scope: AppLockScope) {
  if (scope === "table") return "/service/table";
  return "/service/kitchen";
}

export function getAllowedPrefixesForScope(scope: AppLockScope) {
  return APP_LOCK_ALLOWED_PREFIXES[scope];
}

export function isPathAllowedWhileLocked(pathname: string, scope: AppLockScope) {
  const normalizedPathname = pathname || "/";
  const allowedPrefixes = getAllowedPrefixesForScope(scope);
  return allowedPrefixes.some((prefix) => {
    return (
      normalizedPathname === prefix ||
      normalizedPathname.startsWith(`${prefix}/`)
    );
  });
}

