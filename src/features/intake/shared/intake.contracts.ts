/**
 * Unified Inventory Intake — shared vocabulary and intent contracts.
 *
 * Canonical terminology for the Inventory Intake system.
 *
 * Relationship to existing features:
 * - Live Purchase intent  →  src/features/shopping/*
 * - Bulk Intake intent    →  src/features/receiving/*
 * - Supplier Sync intent  →  src/features/integrations/*
 */

// ---------------------------------------------------------------------------
// Intent model — the three workflow intents in the Unified Intake system
// ---------------------------------------------------------------------------

/**
 * The three top-level workflow intents a user can choose when starting intake.
 *
 * - `live_purchase`:   "I am buying right now" — barcode/manual/photo during active shopping
 * - `bulk_intake`:     "I already bought this" — receipt/invoice/document-based post-purchase entry
 * - `supplier_sync`:  "Sync this source automatically" — integration-driven ingestion (conditional)
 */
export const INTAKE_INTENTS = ["live_purchase", "bulk_intake", "supplier_sync"] as const;
export type IntakeIntent = (typeof INTAKE_INTENTS)[number];

/**
 * Human-readable labels for each intake intent.
 */
export const INTAKE_INTENT_LABELS: Record<IntakeIntent, string> = {
  live_purchase: "Live Purchase",
  bulk_intake: "Bulk Intake",
  supplier_sync: "Supplier Sync",
} as const;

/**
 * Descriptions for each intake intent — used in Hub entry cards.
 */
export const INTAKE_INTENT_DESCRIPTIONS: Record<IntakeIntent, string> = {
  live_purchase: "Log items as you shop — barcode, photo, or manual entry.",
  bulk_intake: "Record a past purchase via receipt scan, invoice, or manual entry.",
  supplier_sync: "Automatically sync inventory from a connected supplier or POS system.",
} as const;

// ---------------------------------------------------------------------------
// Launch invariants and source eligibility contracts (RPK-00 lock)
// ---------------------------------------------------------------------------

/**
 * Canonical intake invariants that must remain true across all launch slices.
 */
export const INTAKE_GLOBAL_INVARIANTS = {
  receipts_do_not_auto_create_inventory: true,
  inventory_writes_are_explicit_and_eligibility_gated: true,
  unresolved_parsed_produce_routes_to_fix_later: true,
} as const;

/**
 * Canonical intake item source vocabulary used for launch policy enforcement.
 */
export const INTAKE_ITEM_SOURCES = [
  "barcode_scan",
  "produce_search",
  "manual_entry",
  "shelf_label_scan",
  "receipt_parse_review",
  "receipt_produce_confirmed",
  "receipt_produce_rejected",
  "receipt_produce_resolve_later",
  "integration_sync",
] as const;
export type IntakeItemSource = (typeof INTAKE_ITEM_SOURCES)[number];

/**
 * Whether a given source can write to inventory in launch mode.
 *
 * - `eligible`: explicit source can write to inventory
 * - `expense_only`: source must only produce expense records
 * - `requires_confirmation`: source can be promoted to inventory only after explicit user confirmation
 * - `resolve_later`: unresolved path that must route to Fix Later
 */
export const INVENTORY_ELIGIBILITY_STATUSES = [
  "eligible",
  "expense_only",
  "requires_confirmation",
  "resolve_later",
] as const;
export type InventoryEligibilityStatus = (typeof INVENTORY_ELIGIBILITY_STATUSES)[number];

export interface IntakeSourceEligibilityPolicy {
  inventory_eligibility: InventoryEligibilityStatus;
  requires_explicit_confirmation: boolean;
  routes_to_fix_later_when_unresolved: boolean;
}

/**
 * Launch policy matrix per source.
 * This is the canonical source-of-truth used by intake/receipt/shopping workflows.
 */
export const INTAKE_SOURCE_ELIGIBILITY: Record<IntakeItemSource, IntakeSourceEligibilityPolicy> = {
  barcode_scan: {
    inventory_eligibility: "eligible",
    requires_explicit_confirmation: true,
    routes_to_fix_later_when_unresolved: false,
  },
  produce_search: {
    inventory_eligibility: "eligible",
    requires_explicit_confirmation: true,
    routes_to_fix_later_when_unresolved: false,
  },
  manual_entry: {
    inventory_eligibility: "expense_only",
    requires_explicit_confirmation: false,
    routes_to_fix_later_when_unresolved: false,
  },
  shelf_label_scan: {
    inventory_eligibility: "expense_only",
    requires_explicit_confirmation: false,
    routes_to_fix_later_when_unresolved: false,
  },
  receipt_parse_review: {
    inventory_eligibility: "requires_confirmation",
    requires_explicit_confirmation: true,
    routes_to_fix_later_when_unresolved: false,
  },
  receipt_produce_confirmed: {
    inventory_eligibility: "eligible",
    requires_explicit_confirmation: true,
    routes_to_fix_later_when_unresolved: false,
  },
  receipt_produce_rejected: {
    inventory_eligibility: "expense_only",
    requires_explicit_confirmation: false,
    routes_to_fix_later_when_unresolved: false,
  },
  receipt_produce_resolve_later: {
    inventory_eligibility: "resolve_later",
    requires_explicit_confirmation: false,
    routes_to_fix_later_when_unresolved: true,
  },
  integration_sync: {
    inventory_eligibility: "requires_confirmation",
    requires_explicit_confirmation: true,
    routes_to_fix_later_when_unresolved: false,
  },
} as const;

export function isInventoryEligibleSource(source: IntakeItemSource): boolean {
  return INTAKE_SOURCE_ELIGIBILITY[source].inventory_eligibility === "eligible";
}

// ---------------------------------------------------------------------------
// Session lifecycle — unified lifecycle applicable to all intake sessions
// ---------------------------------------------------------------------------

/**
 * Unified lifecycle stages for any Inventory Intake session.
 *
 * Applicable across all intent types:
 * - `created`:    Session initialized, not yet active
 * - `active`:     User is actively adding items (Live Purchase) or submitting documents (Bulk Intake)
 * - `reviewing`:  Items are staged and awaiting user review/correction before commit
 * - `committed`:  Session has been committed to inventory — immutable
 * - `archived`:   Session is closed without commit (abandoned/voided)
 */
export const INTAKE_SESSION_STATUSES = [
  "created",
  "active",
  "reviewing",
  "committed",
  "archived",
] as const;
export type IntakeSessionStatus = (typeof INTAKE_SESSION_STATUSES)[number];

/**
 * Terminal states — sessions in these states cannot transition further.
 */
export const INTAKE_TERMINAL_STATUSES: ReadonlySet<IntakeSessionStatus> = new Set([
  "committed",
  "archived",
] satisfies IntakeSessionStatus[]);

// ---------------------------------------------------------------------------
// Capability model — drives which intake intents are available per business
// ---------------------------------------------------------------------------

/**
 * Discrete capabilities that can be enabled or disabled per business context.
 * Used to drive intent card visibility and ordering in the Intake Hub (UI-01+).
 *
 * - `barcode_capture`:   Camera/scanner barcode input during live purchase
 * - `photo_assistance`:  Photo OCR for item/produce identification
 * - `receipt_parse`:     Document/receipt parsing for bulk intake
 * - `manual_entry`:      Free-form manual item entry (always available)
 * - `supplier_sync`:     POS/distributor integration sync (requires connection)
 * - `produce_entry`:     Weight/count based produce capture (restaurant/retail)
 * - `invoice_entry`:     Invoice/paperwork-based bulk intake (contractor/salon)
 */
export const INTAKE_CAPABILITIES = [
  "barcode_capture",
  "photo_assistance",
  "receipt_parse",
  "manual_entry",
  "supplier_sync",
  "produce_entry",
  "invoice_entry",
] as const;
export type IntakeCapability = (typeof INTAKE_CAPABILITIES)[number];

/**
 * Maps each intake intent to the capabilities it embeds.
 * Used by the Intake Hub to render the correct sub-actions inside each intent card.
 */
export const INTAKE_INTENT_CAPABILITIES: Record<IntakeIntent, readonly IntakeCapability[]> = {
  live_purchase: ["barcode_capture", "produce_entry", "manual_entry", "photo_assistance"],
  bulk_intake: ["receipt_parse", "invoice_entry", "manual_entry", "photo_assistance"],
  supplier_sync: ["supplier_sync"],
} as const;

// ---------------------------------------------------------------------------
// Industry defaults — which intents are emphasized per industry type
// ---------------------------------------------------------------------------

import type { IndustryType } from "@/lib/generated/prisma/client";

/**
 * Ordered list of primary intake intents per industry.
 * Earlier = higher priority in the Intake Hub card ordering.
 * All intents remain available regardless of industry — ordering is advisory only.
 */
export const INTAKE_INTENT_ORDER_BY_INDUSTRY: Record<IndustryType, readonly IntakeIntent[]> = {
  restaurant: ["live_purchase", "bulk_intake", "supplier_sync"],
  retail: ["live_purchase", "bulk_intake", "supplier_sync"],
  salon: ["bulk_intake", "live_purchase", "supplier_sync"],
  contractor: ["live_purchase", "bulk_intake", "supplier_sync"],
  general: ["live_purchase", "bulk_intake", "supplier_sync"],
} as const;
