import {
  parseDocumentFromJson,
  parseDocumentFromPostmark,
  scoreDocumentConfidence,
} from "@/domain/parsers/document-draft";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { PostmarkInboundPayload } from "@/features/documents/shared";
import {
  findDraftById,
  updateDraftParsedFields,
} from "./document-draft.repository";
import { loadRawDocument } from "./document-storage.service";

function toDateOrNull(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mergeParseFlags(
  existing: unknown,
  additions: Record<string, unknown>,
): Record<string, unknown> {
  const base = asRecord(existing);
  return {
    ...base,
    ...additions,
  };
}

async function attemptVendorAutoResolution(businessId: string, draftId: string) {
  try {
    const vendorMappingModule = await import("./" + "vendor-mapping.service");
    const candidate = (vendorMappingModule as Record<string, unknown>).resolveVendorForDraft;
    if (typeof candidate === "function") {
      await (candidate as (businessId: string, draftId: string) => Promise<unknown>)(
        businessId,
        draftId,
      );
    }
  } catch {
    // DI-03 wiring is optional while DI-02 is active.
  }
}

export async function parseAndSaveDraft(businessId: string, draftId: string) {
  const draft = await findDraftById(businessId, draftId);
  if (!draft) return null;

  try {
    const raw = await loadRawDocument(draft.raw_storage_path);
    const payloadText = raw.content.toString("utf8");
    const parsedPayload = JSON.parse(payloadText) as PostmarkInboundPayload | Record<string, unknown>;

    const fields =
      draft.inbound_channel === "email"
        ? parseDocumentFromPostmark(parsedPayload as PostmarkInboundPayload)
        : parseDocumentFromJson(parsedPayload);

    const confidence = scoreDocumentConfidence(fields);
    const updated = await updateDraftParsedFields(businessId, draftId, {
      parsedVendorName: fields.vendor_name,
      parsedDate: toDateOrNull(fields.date),
      parsedTotal: fields.total,
      parsedTax: fields.tax,
      parsedLineItems: fields.line_items as unknown as Prisma.InputJsonValue,
      confidenceScore: confidence.score,
      confidenceBand: confidence.band,
      parseFlags: mergeParseFlags(draft.parse_flags, {
        parser: {
          confidence_score: confidence.score,
          confidence_band: confidence.band,
          flags: confidence.flags,
          parsed_at: new Date().toISOString(),
          parser_version: "di02-v1",
        },
      }) as Prisma.InputJsonValue,
      status: "pending_review",
    });

    await attemptVendorAutoResolution(businessId, draftId);
    return updated;
  } catch (error) {
    await updateDraftParsedFields(businessId, draftId, {
      status: "draft",
      parseFlags: mergeParseFlags(draft.parse_flags, {
        parser_error: {
          message: error instanceof Error ? error.message : String(error),
          failed_at: new Date().toISOString(),
        },
      }) as Prisma.InputJsonValue,
    }).catch(() => null);

    return null;
  }
}
