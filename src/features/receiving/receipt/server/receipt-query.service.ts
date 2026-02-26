/**
 * Receipt query service.
 * Handles reading/fetching receipts with optional signed image URLs.
 */

import { getReceiptImageSignedUrl } from "@/server/storage/supabase/receipt-images";
import {
  findReceiptById,
  findReceiptDetail,
  findReceipts,
} from "./receipt.repository";

/**
 * Get receipt with line items for display.
 */
export async function getReceiptWithLineItems(
  receiptId: string,
  businessId: string,
) {
  return findReceiptById(receiptId, businessId);
}

/**
 * Fetch full receipt detail for the receipt viewer page.
 * Includes line items with matched inventory names and a short-lived signed URL
 * for the original receipt image (if one was uploaded).
 */
export async function getReceiptDetail(
  receiptId: string,
  businessId: string,
) {
  const receipt = await findReceiptDetail(receiptId, businessId);
  if (!receipt) return null;

  const signedImageUrl = receipt.image_path
    ? await getReceiptImageSignedUrl(receipt.image_path)
    : null;

  return {
    ...receipt,
    signed_image_url: signedImageUrl,
  };
}

/**
 * Fetch list of receipts, optionally filtered by status.
 */
export async function getReceipts(businessId: string, status?: string) {
  return findReceipts(businessId, status);
}
