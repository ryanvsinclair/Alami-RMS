"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

const PIN_LENGTH = 4;

function cx(...classes: Array<string | false>) {
  return classes.filter(Boolean).join(" ");
}

export function PinKeypadModal({
  open,
  title,
  subtitle,
  error,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  error?: string;
  onSubmit: (pin: string) => void;
  onCancel?: () => void;
}) {
  const [pin, setPin] = useState("");

  function pushDigit(digit: string) {
    if (pin.length >= PIN_LENGTH) return;
    const next = `${pin}${digit}`;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      setPin("");
      onSubmit(next);
    }
  }

  function popDigit() {
    if (pin.length === 0) return;
    setPin(pin.slice(0, -1));
  }

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/55 p-3">
      <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--surface-card-shadow)]">
        <div className="border-b border-border/60 px-4 py-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div />
            <h2 className="text-sm font-semibold text-foreground text-center">{title}</h2>
            <div className="text-right">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-sm font-medium text-primary"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-5 text-center">
          <p className="text-sm text-muted">{subtitle}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            {Array.from({ length: PIN_LENGTH }).map((_, idx) => (
              <span
                key={idx}
                className={cx(
                  "inline-block h-3.5 w-3.5 rounded-full border border-foreground/40",
                  idx < pin.length && "bg-foreground",
                )}
              />
            ))}
          </div>
          {error && <p className="mt-3 text-xs font-medium text-danger">{error}</p>}
        </div>

        <div className="border-t border-border/60 bg-foreground/[0.03] px-3 py-3">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => pushDigit(String(digit))}
                className="h-12 rounded-lg border border-border bg-card text-lg font-medium text-foreground transition-colors hover:bg-foreground/[0.05]"
              >
                {digit}
              </button>
            ))}
            <div />
            <button
              type="button"
              onClick={() => pushDigit("0")}
              className="h-12 rounded-lg border border-border bg-card text-lg font-medium text-foreground transition-colors hover:bg-foreground/[0.05]"
            >
              0
            </button>
            <button
              type="button"
              onClick={popDigit}
              className="h-12 rounded-lg border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:bg-foreground/[0.05]"
              aria-label="Delete"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
