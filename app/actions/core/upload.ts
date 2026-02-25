"use server";

import { uploadReceiptImage } from "@/lib/supabase/storage";
import { requireBusinessId } from "@/core/auth/tenant";

export async function uploadReceiptImageAction(
  base64DataUri: string,
  sessionId: string
): Promise<string> {
  const businessId = await requireBusinessId();
  const timestamp = Date.now();
  const path = `receipts/${businessId}/${sessionId}-${timestamp}.jpg`;
  return uploadReceiptImage(base64DataUri, path);
}
