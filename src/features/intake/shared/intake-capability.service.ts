/**
 * Unified Inventory Intake — capability gating service.
 *
 * Resolves the active set of IntakeCapabilities for a given business context
 * and determines intent visibility + ordering from those capabilities.
 *
 * Design rule:
 *  - UI visibility must be driven by capability flags — NOT by hardcoded
 *    per-industry route forks or scattered module checks in components.
 *  - All capability decisions route through this service.
 *  - Pure functions only — no schema/DB interaction.
 */

import type { IndustryType } from "@/lib/generated/prisma/client";
import {
  INTAKE_INTENT_CAPABILITIES,
  INTAKE_INTENT_ORDER_BY_INDUSTRY,
  type IntakeCapability,
  type IntakeIntent,
} from "./intake.contracts";

// ---------------------------------------------------------------------------
// Capability rules — which capabilities are available per industry + module
// ---------------------------------------------------------------------------

/**
 * Capabilities that are always available regardless of industry or modules.
 */
const ALWAYS_AVAILABLE_CAPABILITIES: ReadonlySet<IntakeCapability> = new Set<IntakeCapability>([
  "manual_entry",
]);

/**
 * Capabilities enabled per industry type (additive on top of ALWAYS_AVAILABLE).
 * Based on the product framing in unified-inventory-intake-refactor-plan.md:
 *  - Restaurants: produce-heavy + receipt parsing + supplier sync
 *  - Contractors: barcode-heavy + bulk invoice
 *  - Salons: receipt/invoice-heavy + repeat supplier
 *  - Retail: barcode + bulk receipt/restock
 *  - General: conservative baseline
 */
const INDUSTRY_CAPABILITIES: Record<IndustryType, readonly IntakeCapability[]> = {
  restaurant: [
    "barcode_capture",
    "photo_assistance",
    "receipt_parse",
    "produce_entry",
    "invoice_entry",
  ],
  contractor: [
    "barcode_capture",
    "photo_assistance",
    "receipt_parse",
    "invoice_entry",
  ],
  salon: [
    "receipt_parse",
    "invoice_entry",
    "photo_assistance",
  ],
  retail: [
    "barcode_capture",
    "photo_assistance",
    "receipt_parse",
    "invoice_entry",
  ],
  general: [
    "barcode_capture",
    "receipt_parse",
  ],
};

/**
 * Module-gated capabilities — only available when the named module is enabled.
 * Key = capability, Value = required module id.
 */
const MODULE_GATED_CAPABILITIES: Partial<Record<IntakeCapability, string>> = {
  supplier_sync: "integrations",
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves the full set of active IntakeCapabilities for a given business context.
 *
 * Resolution order:
 *  1. Always-available capabilities (manual_entry)
 *  2. Industry-specific capabilities from INDUSTRY_CAPABILITIES
 *  3. Module-gated capabilities filtered by enabledModules
 *
 * @param industryType  The business industry type.
 * @param enabledModules  The list of enabled module IDs, or null/undefined if unconstrained.
 * @returns  ReadonlySet of active IntakeCapability values.
 */
export function resolveIntakeCapabilities(
  industryType: IndustryType,
  enabledModules: string[] | null | undefined
): ReadonlySet<IntakeCapability> {
  const result = new Set<IntakeCapability>(ALWAYS_AVAILABLE_CAPABILITIES);

  // Add industry capabilities
  for (const cap of INDUSTRY_CAPABILITIES[industryType] ?? []) {
    result.add(cap);
  }

  // Add module-gated capabilities (only if the required module is enabled)
  const moduleSet = enabledModules != null ? new Set(enabledModules) : null;
  for (const [cap, requiredModule] of Object.entries(MODULE_GATED_CAPABILITIES) as [IntakeCapability, string][]) {
    if (moduleSet == null || moduleSet.has(requiredModule)) {
      result.add(cap);
    }
  }

  return result as ReadonlySet<IntakeCapability>;
}

/**
 * Returns true if the given intent should be visible for the provided capability set.
 *
 * An intent is visible if at least one of its required capabilities is active.
 * `manual_entry` is a universal capability — so intents that include it are
 * always visible (live_purchase and bulk_intake always include manual_entry).
 * `supplier_sync` intent only contains `supplier_sync` capability, so it is
 * hidden when that module-gated capability is absent.
 *
 * @param intent       The intake intent to test.
 * @param capabilities The resolved capability set for the current business context.
 */
export function isIntentVisible(
  intent: IntakeIntent,
  capabilities: ReadonlySet<IntakeCapability>
): boolean {
  const required = INTAKE_INTENT_CAPABILITIES[intent];
  return required.some((cap) => capabilities.has(cap));
}

/**
 * Returns the ordered, visible intent list for a given business context.
 *
 * Combines industry-ordered intent list (from UI-00 contracts) with
 * capability-gate visibility filtering (from UI-03 rules).
 *
 * @param industryType   The business industry type.
 * @param enabledModules The list of enabled module IDs, or null/undefined.
 * @returns  Ordered array of visible IntakeIntent values.
 */
export function resolveVisibleIntents(
  industryType: IndustryType,
  enabledModules: string[] | null | undefined
): readonly IntakeIntent[] {
  const capabilities = resolveIntakeCapabilities(industryType, enabledModules);
  return INTAKE_INTENT_ORDER_BY_INDUSTRY[industryType].filter((intent) =>
    isIntentVisible(intent, capabilities)
  );
}
