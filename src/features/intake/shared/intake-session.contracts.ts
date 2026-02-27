/**
 * Unified Inventory Intake — session orchestration adapter contracts.
 *
 * Bridges existing session/lifecycle models from the Shopping and Receiving
 * features to the canonical IntakeSessionStatus vocabulary defined in
 * intake.contracts.ts.
 *
 * Status models being mapped:
 *  - ShoppingSessionStatus: draft | reconciling | ready | committed | cancelled
 *  - ReceiptStatus:         pending | parsing | review | committed | failed
 *
 * Both map to the canonical IntakeSessionStatus:
 *  - created | active | reviewing | committed | archived
 */

import type { IntakeSessionStatus, IntakeIntent } from "./intake.contracts";

// ---------------------------------------------------------------------------
// Shopping session → IntakeSessionStatus mapping
// ---------------------------------------------------------------------------

/**
 * Maps a ShoppingSession status to the canonical IntakeSessionStatus.
 *
 * Mapping rationale:
 *  draft        → active     (session started, items being added)
 *  reconciling  → reviewing  (receipt scanned, user reviewing mismatches)
 *  ready        → reviewing  (balanced but not yet committed — still in review UX)
 *  committed    → committed  (session committed to inventory)
 *  cancelled    → archived   (session closed without commit)
 */
export function shoppingStatusToIntakeStatus(
  shoppingStatus: string
): IntakeSessionStatus {
  switch (shoppingStatus) {
    case "draft":
      return "active";
    case "reconciling":
      return "reviewing";
    case "ready":
      return "reviewing";
    case "committed":
      return "committed";
    case "cancelled":
      return "archived";
    default:
      return "active";
  }
}

// ---------------------------------------------------------------------------
// Receipt → IntakeSessionStatus mapping
// ---------------------------------------------------------------------------

/**
 * Maps a Receipt status to the canonical IntakeSessionStatus.
 *
 * Mapping rationale:
 *  pending    → created    (receipt record created, OCR not yet run)
 *  parsing    → active     (OCR + correction pipeline running)
 *  review     → reviewing  (line items parsed, user reviewing/editing)
 *  committed  → committed  (receipt committed to inventory)
 *  failed     → archived   (pipeline failed — treated as archived/closed)
 */
export function receiptStatusToIntakeStatus(
  receiptStatus: string
): IntakeSessionStatus {
  switch (receiptStatus) {
    case "pending":
      return "created";
    case "parsing":
      return "active";
    case "review":
      return "reviewing";
    case "committed":
      return "committed";
    case "failed":
      return "archived";
    default:
      return "active";
  }
}

// ---------------------------------------------------------------------------
// Unified intake session summary DTO
// ---------------------------------------------------------------------------

/**
 * A lightweight unified session summary that the Intake Hub and future
 * session list views can consume regardless of the underlying session type.
 *
 * Does NOT replace underlying session models — it is a read-only projection
 * used at the orchestration/routing layer only.
 */
export interface IntakeSessionSummary {
  /** Canonical intake session status (mapped from underlying model). */
  intakeStatus: IntakeSessionStatus;
  /** Which intake intent this session belongs to. */
  intent: IntakeIntent;
  /** Underlying session ID (ShoppingSession.id or Receipt.id). */
  underlyingId: string;
  /** Human-readable label for display (store name, supplier name, or date). */
  label: string;
  /** ISO timestamp when the session was started/created. */
  startedAt: string;
  /** ISO timestamp when the session was last updated, if available. */
  updatedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Intent → route builder
// ---------------------------------------------------------------------------

/**
 * Build the resume/continue route for an active intake session.
 * Routes to the existing underlying flow for the session's intent.
 *
 * Compatibility layer — routes to existing flows without changing them.
 */
export function buildIntakeSessionRoute(
  intent: IntakeIntent,
  underlyingId: string
): string {
  switch (intent) {
    case "live_purchase":
      // Shopping sessions are identified by business (single active session)
      return "/shopping";
    case "bulk_intake":
      // Receipt sessions route to the specific receipt review page
      return `/receive/receipt/${underlyingId}`;
    case "supplier_sync":
      // Supplier sync sessions route to the integrations page
      return "/integrations";
    default:
      return "/intake";
  }
}

/**
 * Derive the intake intent from a session's underlying origin.
 * Used when mapping existing sessions to the Intake vocabulary.
 */
export function deriveIntentFromSessionOrigin(
  origin: "shopping" | "receipt" | "integration"
): IntakeIntent {
  switch (origin) {
    case "shopping":
      return "live_purchase";
    case "receipt":
      return "bulk_intake";
    case "integration":
      return "supplier_sync";
  }
}
