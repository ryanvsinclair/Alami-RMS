"use server";

import { uploadReceiptImage } from "@/lib/supabase/storage";
import { requireRestaurantId } from "@/lib/auth/tenant";

export async function uploadReceiptImageAction(
  base64DataUri: string,
  sessionId: string
): Promise<string> {
  const restaurantId = await requireRestaurantId();
  const timestamp = Date.now();
  const path = `receipts/${restaurantId}/${sessionId}-${timestamp}.jpg`;
  return uploadReceiptImage(base64DataUri, path);
}
