"use client";

/**
 * Unified Inventory Intake Hub — UI-01/UI-03.
 *
 * Intent-first landing surface for all inventory intake workflows.
 * Renders ordered intent cards based on capability-driven visibility
 * resolved from industry type and enabled modules (UI-03).
 *
 * Visibility gating delegates to resolveVisibleIntents() — no hardcoded
 * per-intent module checks in this component.
 *
 * Routing (compatibility wrappers — existing routes preserved):
 *   live_purchase  →  /shopping       (existing Shopping flow)
 *   bulk_intake    →  /receive        (existing Receive flow)
 *   supplier_sync  →  /integrations   (capability-gated via service)
 *
 * No behavior changes to existing flows.
 * All existing /shopping and /receive routes remain fully operational.
 */

import { useRouter } from "next/navigation";
import { useBusinessConfig } from "@/shared/config/business-context";
import {
  INTAKE_INTENT_LABELS,
  INTAKE_INTENT_DESCRIPTIONS,
  resolveVisibleIntents,
  type IntakeIntent,
} from "@/features/intake/shared";

// ---------------------------------------------------------------------------
// Intent → route mapping (compatibility layer — existing routes preserved)
// ---------------------------------------------------------------------------

const INTENT_HREF: Record<IntakeIntent, string> = {
  live_purchase: "/shopping",
  bulk_intake: "/receive",
  supplier_sync: "/integrations",
};

// ---------------------------------------------------------------------------
// Visual identity per intent card
// ---------------------------------------------------------------------------

const INTENT_ICON: Record<IntakeIntent, React.ReactNode> = {
  live_purchase: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.085.837l.383 1.437m0 0L6.75 12h10.5l2.01-5.69a.75.75 0 0 0-.707-.997H5.104Zm1.146 6.69a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10.5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
    </svg>
  ),
  bulk_intake: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
    </svg>
  ),
  supplier_sync: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 17.25h7.5M6.75 9.75h10.5v4.5H6.75v-4.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75v3m6-3v3m-6 10.5v3m6-3v3" />
    </svg>
  ),
};

const INTENT_COLOR: Record<IntakeIntent, string> = {
  live_purchase: "text-blue-300 bg-blue-400/14 ring-1 ring-inset ring-blue-300/26",
  bulk_intake: "text-success bg-success/14 ring-1 ring-inset ring-success/26",
  supplier_sync: "text-violet-300 bg-violet-400/14 ring-1 ring-inset ring-violet-300/26",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IntakeHubClient() {
  const router = useRouter();
  const { industryType, enabledModules } = useBusinessConfig();

  // UI-03: capability-gate driven visibility — delegates to resolveVisibleIntents()
  // rather than hardcoded per-intent module checks.
  const visibleIntents = resolveVisibleIntents(industryType, enabledModules);

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm text-muted">
        Choose how you want to record inventory.
      </p>

      {visibleIntents.map((intent) => (
        <button
          key={intent}
          type="button"
          onClick={() => router.push(INTENT_HREF[intent])}
          className="w-full text-left rounded-3xl border border-border bg-card p-4 shadow-[var(--surface-card-shadow)] transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-4">
            <div className={`rounded-xl p-3 ${INTENT_COLOR[intent]}`}>
              {INTENT_ICON[intent]}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">
                {INTAKE_INTENT_LABELS[intent]}
              </h3>
              <p className="text-sm text-muted/90">
                {INTAKE_INTENT_DESCRIPTIONS[intent]}
              </p>
            </div>
            <svg
              className="w-5 h-5 text-muted/90 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </button>
      ))}
    </div>
  );
}
