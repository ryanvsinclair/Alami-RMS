import { createServiceClient } from "@/server/storage/supabase/client";
import { ITEM_IMAGES_BUCKET } from "../shared/item-image.contracts";

const IMAGE_FETCH_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

function normalizeStoragePath(storagePath: string) {
  return storagePath.trim().replace(/^\/+/, "");
}

function normalizeContentType(contentType: string | null | undefined) {
  const lowered = contentType?.toLowerCase().split(";")[0]?.trim();
  if (!lowered) return "image/jpeg";
  return lowered.startsWith("image/") ? lowered : "image/jpeg";
}

function inferContentTypeFromPath(storagePath: string) {
  const lowerPath = storagePath.toLowerCase();
  if (lowerPath.endsWith(".png")) return "image/png";
  if (lowerPath.endsWith(".webp")) return "image/webp";
  if (lowerPath.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function splitStoragePath(storagePath: string) {
  const normalized = normalizeStoragePath(storagePath);
  const slashIndex = normalized.lastIndexOf("/");
  if (slashIndex < 0) {
    return { folder: "", fileName: normalized };
  }
  return {
    folder: normalized.slice(0, slashIndex),
    fileName: normalized.slice(slashIndex + 1),
  };
}

export class ImageFetchError extends Error {
  sourceUrl: string;
  statusCode: number | null;

  constructor(message: string, opts: { sourceUrl: string; statusCode?: number | null }) {
    super(message);
    this.name = "ImageFetchError";
    this.sourceUrl = opts.sourceUrl;
    this.statusCode = opts.statusCode ?? null;
  }
}

export class ImageStorageError extends Error {
  storagePath: string | null;

  constructor(message: string, opts?: { storagePath?: string | null }) {
    super(message);
    this.name = "ImageStorageError";
    this.storagePath = opts?.storagePath ?? null;
  }
}

export async function uploadImageFromBuffer(
  buffer: Buffer,
  storagePath: string,
  contentType: string,
): Promise<{ storagePath: string; publicUrl: string }> {
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageStorageError("Image buffer exceeds 5MB size limit.", {
      storagePath,
    });
  }

  const normalizedPath = normalizeStoragePath(storagePath);
  const supabase = createServiceClient();

  const { error } = await supabase.storage
    .from(ITEM_IMAGES_BUCKET)
    .upload(normalizedPath, buffer, {
      contentType: normalizeContentType(contentType),
      upsert: true,
    });

  if (error) {
    throw new ImageStorageError(`Storage upload failed: ${error.message}`, {
      storagePath: normalizedPath,
    });
  }

  const publicUrl = await getImageSignedUrl(normalizedPath, DEFAULT_SIGNED_URL_TTL_SECONDS);
  return { storagePath: normalizedPath, publicUrl };
}

export async function uploadImageFromUrl(
  sourceUrl: string,
  storagePath: string,
): Promise<{ storagePath: string; publicUrl: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(sourceUrl, {
      signal: controller.signal,
      redirect: "follow",
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? `Image fetch timed out after ${IMAGE_FETCH_TIMEOUT_MS}ms.`
        : error instanceof Error
          ? error.message
          : "Image fetch failed.";
    throw new ImageFetchError(message, { sourceUrl });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new ImageFetchError(`Image fetch failed with status ${response.status}.`, {
      sourceUrl,
      statusCode: response.status,
    });
  }

  const contentLengthHeader = response.headers.get("content-length");
  const parsedContentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : NaN;
  if (Number.isFinite(parsedContentLength) && parsedContentLength > MAX_IMAGE_BYTES) {
    throw new ImageFetchError("Remote image exceeds 5MB size limit.", { sourceUrl });
  }

  const imageBytes = Buffer.from(await response.arrayBuffer());
  if (imageBytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageFetchError("Fetched image exceeds 5MB size limit.", { sourceUrl });
  }

  const responseContentType = normalizeContentType(response.headers.get("content-type"));
  const inferredContentType =
    responseContentType === "image/jpeg"
      ? inferContentTypeFromPath(storagePath)
      : responseContentType;

  return uploadImageFromBuffer(imageBytes, storagePath, inferredContentType);
}

export async function getImageSignedUrl(
  storagePath: string,
  expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const normalizedPath = normalizeStoragePath(storagePath);
  const supabase = createServiceClient();

  const { data, error } = await supabase.storage
    .from(ITEM_IMAGES_BUCKET)
    .createSignedUrl(normalizedPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new ImageStorageError(
      `Failed to create signed image URL: ${error?.message ?? "unknown storage error"}`,
      { storagePath: normalizedPath },
    );
  }

  return data.signedUrl;
}

export async function imageExistsInStorage(storagePath: string): Promise<boolean> {
  const normalizedPath = normalizeStoragePath(storagePath);
  const { folder, fileName } = splitStoragePath(normalizedPath);
  if (!fileName) return false;

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(ITEM_IMAGES_BUCKET)
    .list(folder, { search: fileName, limit: 100 });

  if (error) {
    throw new ImageStorageError(`Failed to inspect storage path: ${error.message}`, {
      storagePath: normalizedPath,
    });
  }

  return (data ?? []).some((entry) => entry.name === fileName);
}
