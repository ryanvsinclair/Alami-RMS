import { createServiceClient } from "./server";

const BUCKET = "receipt-images";

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

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
