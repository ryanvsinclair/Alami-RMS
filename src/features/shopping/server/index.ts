/**
 * Shopping feature server barrel export.
 * Re-exports all shopping server services for convenient imports.
 */

// Contracts & types
export * from "./contracts";

// Helpers (pure functions)
export {
  toNumber,
  round,
  clamp,
  normalizeName,
  normalizeSpace,
  asJsonRecord,
  mergeResolutionAudit,
  buildExternalBarcodeDisplayName,
  isGenericUnresolvedShoppingLabel,
  scoreShoppingReceiptLineCandidate,
  scoreReceiptItemAgainstWebFallback,
  parseReceiptTotals,
  getSelectedShoppingLineSubtotal,
  getReceiptBalanceCheck,
} from "./helpers";

// Repository
export {
  findActiveSession,
  findSessionById,
  findSessionWithItems,
  findSessionWithItemsAndSupplier,
  findFullSession,
} from "./session.repository";

// Services
export { recomputeSessionState } from "./session-state.service";
export { upsertSupplierFromGooglePlace } from "./supplier-place.service";
export { linkScannedBarcodeToInventoryItemIfHighConfidence } from "./barcode-link.service";
export {
  reconcileShoppingSessionReceipt,
  reconcileWithTabScannerData,
  scanAndReconcileReceipt,
} from "./receipt-reconcile.service";
export { pairShoppingSessionBarcodeItemToReceiptItem } from "./pairing.service";
export { analyzeShoppingSessionBarcodeItemPhoto } from "./fallback-photo.service";
export { suggestShoppingSessionBarcodeReceiptPairWithWebFallback } from "./fallback-web.service";
export { commitShoppingSession } from "./commit.service";
export {
  getCommittedShoppingSessions,
  getItemPriceHistory,
  reorderShoppingSession,
} from "./history.service";
