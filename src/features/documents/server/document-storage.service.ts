import { createServiceClient } from "@/server/storage/supabase/client";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;
const DEFAULT_DOCUMENTS_BUCKET = "documents";

export interface StoreRawDocumentInput {
  businessId: string;
  draftId: string;
  content: Buffer;
  contentType: string;
  filename: string;
}

export class DocumentStorageError extends Error {
  readonly storagePath: string | null;

  constructor(message: string, options?: { storagePath?: string | null }) {
    super(message);
    this.name = "DocumentStorageError";
    this.storagePath = options?.storagePath ?? null;
  }
}

function getDocumentsBucketName() {
  return process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS?.trim() || DEFAULT_DOCUMENTS_BUCKET;
}

function normalizePathSegment(value: string, fallback: string) {
  const normalized = value.trim().replace(/[\\/]+/g, "_");
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeFilename(fileName: string) {
  const normalized = fileName.trim().replace(/^\/+/, "").replace(/[\\/]+/g, "_");
  if (!normalized) return "raw.bin";
  return normalized;
}

export function buildDocumentStoragePath(input: {
  businessId: string;
  draftId: string;
  filename: string;
}) {
  const businessId = normalizePathSegment(input.businessId, "unknown-business");
  const draftId = normalizePathSegment(input.draftId, "unknown-draft");
  const fileName = normalizeFilename(input.filename);
  return `${businessId}/${draftId}/${fileName}`;
}

export async function storeRawDocument(input: StoreRawDocumentInput) {
  const storagePath = buildDocumentStoragePath({
    businessId: input.businessId,
    draftId: input.draftId,
    filename: input.filename,
  });

  const bucket = getDocumentsBucketName();
  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(bucket).upload(storagePath, input.content, {
    contentType: input.contentType,
    upsert: true,
  });

  if (error) {
    throw new DocumentStorageError(`Storage upload failed: ${error.message}`, { storagePath });
  }

  return { storagePath };
}

export async function getRawDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
) {
  const normalizedPath = storagePath.trim().replace(/^\/+/, "");
  if (!normalizedPath) {
    throw new DocumentStorageError("Storage path is required to create a signed URL");
  }

  const bucket = getDocumentsBucketName();
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(normalizedPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new DocumentStorageError(
      `Failed to create signed document URL: ${error?.message ?? "unknown storage error"}`,
      { storagePath: normalizedPath },
    );
  }

  return data.signedUrl;
}
