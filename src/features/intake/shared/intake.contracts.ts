/**
 * Unified Inventory Intake — shared vocabulary and intent contracts (UI-00 Phase 0).
 *
 * This file defines the canonical terminology for the Inventory Intake system.
 * It does NOT change any existing behavior — existing Shopping and Receiving
 * features continue to operate independently. This vocabulary layer establishes
 * the shared language that future Intake Hub phases (UI-01 through UI-06) will
 * build on top of.
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
