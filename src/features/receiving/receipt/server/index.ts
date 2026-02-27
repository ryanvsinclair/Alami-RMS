/**
 * Receipt feature server barrel export.
 * Canonical entry point for all receipt server services.
 */

// Contracts and types
export type {
  ResolvedLineItem,
  ParsedDataSummary,
} from "./contracts";
export type {
  ReceiptPostOcrCorrectionInput,
  ReceiptPostOcrCorrectionMode,
  ReceiptPostOcrCorrectionResult,
  ReceiptPostOcrCorrectionSummary,
} from "./receipt-correction.contracts";

// Repository
export {
  findReceiptById,
  findReceiptDetail,
  findReceipts,
  findReceiptWithSupplier,
  createReceiptRecord,
  updateReceiptStatus,
  deleteLineItems,
  createLineItem,
  findLineItemWithReceipt,
  updateLineItem,
} from "./receipt.repository";

// Workflow services
export {
  createReceipt,
  parseAndMatchReceipt,
  processReceiptText,
  processReceiptImage,
} from "./receipt-workflow.service";
export {
  getReceiptPostOcrCorrectionMode,
  runReceiptPostOcrCorrection,
} from "./receipt-correction.service";
export {
  buildReceiptParseProfileKey,
  resolveReceiptParseProfilePrior,
  recordReceiptParseProfileFromCorrection,
  recordReceiptParseProfileLineReviewFeedback,
} from "./receipt-parse-profile.service";

// Line item services
export { updateLineItemMatch } from "./line-item.service";

// Query services
export {
  getReceiptWithLineItems,
  getReceiptDetail,
  getReceipts,
} from "./receipt-query.service";
