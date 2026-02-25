import { createServiceClient } from "./server";

const BUCKET = "receipt-images";

/**
 * Upload a receipt image to the private bucket.
 * Returns the storage path (NOT a public URL).
 */
export async function uploadReceiptImage(
  base64DataUri: string,
  path: string
): Promise<string> {
  const supabase = createServiceClient();

  const base64 = base64DataUri.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  const mimeMatch = base64DataUri.match(/^data:(image\/\w+);base64,/);
  const contentType = mimeMatch?.[1] ?? "image/jpeg";

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return path;
}

/**
 * Generate a short-lived signed URL for a private receipt image.
 * Default expiry: 5 minutes (300 seconds).
 */
export async function getReceiptImageSignedUrl(
  path: string,
  expiresIn = 300
): Promise<string | null> {
  if (!path) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
