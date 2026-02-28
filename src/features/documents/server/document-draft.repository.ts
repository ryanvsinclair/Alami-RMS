import { Prisma } from "@/lib/generated/prisma/client";
import type {
  DocumentDraft,
  DocumentInboundChannel,
  MatchConfidence,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import type { DocumentDraftStatus } from "@/features/documents/shared";

export interface CreateDraftInput {
  businessId: string;
  inboundChannel: DocumentInboundChannel;
  rawStoragePath: string;
  rawContentType: string;
  rawContentHash: string;
  postmarkMessageId?: string | null;
}

export interface CreateDraftResult {
  draft: DocumentDraft;
  duplicate: boolean;
}

export interface DraftParsedFieldsUpdate {
  parsedVendorName?: string | null;
  parsedDate?: Date | null;
  parsedTotal?: number | null;
  parsedTax?: number | null;
  parsedLineItems?: Prisma.InputJsonValue | null;
  confidenceScore?: number | null;
  confidenceBand?: MatchConfidence | null;
  parseFlags?: Prisma.InputJsonValue | null;
  anomalyFlags?: Prisma.InputJsonValue | null;
  status?: DocumentDraftStatus;
}

export interface DraftPostedStateUpdate {
  financialTransactionId: string;
  postedByUserId: string | null;
  autoPosted: boolean;
}

export interface DraftIngestArtifactsUpdate {
  rawStoragePath: string;
  parseFlags?: Prisma.InputJsonValue | null;
}

function toDecimalOrNull(value: number | null | undefined, precision = 2) {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  return new Prisma.Decimal(value.toFixed(precision));
}

function isRawHashUniqueViolation(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : "";
  return (
    target.includes("document_drafts_business_id_raw_content_hash_key") ||
    (target.includes("business_id") && target.includes("raw_content_hash"))
  );
}

export async function createDraft(input: CreateDraftInput): Promise<CreateDraftResult> {
  try {
    const created = await prisma.documentDraft.create({
      data: {
        business_id: input.businessId,
        inbound_channel: input.inboundChannel,
        raw_storage_path: input.rawStoragePath,
        raw_content_type: input.rawContentType,
        raw_content_hash: input.rawContentHash,
        postmark_message_id: input.postmarkMessageId ?? null,
        status: "received",
      },
    });

    return {
      draft: created,
      duplicate: false,
    };
  } catch (error) {
    if (!isRawHashUniqueViolation(error)) {
      throw error;
    }

    const existing = await prisma.documentDraft.findFirst({
      where: {
        business_id: input.businessId,
        raw_content_hash: input.rawContentHash,
      },
    });

    if (!existing) throw error;
    return {
      draft: existing,
      duplicate: true,
    };
  }
}

export async function findDraftByRawHash(
  businessId: string,
  rawContentHash: string,
) {
  return prisma.documentDraft.findFirst({
    where: {
      business_id: businessId,
      raw_content_hash: rawContentHash,
    },
    orderBy: { created_at: "desc" },
  });
}

export async function findDraftById(businessId: string, draftId: string) {
  return prisma.documentDraft.findFirst({
    where: {
      id: draftId,
      business_id: businessId,
    },
  });
}

export async function findDraftsByStatus(
  businessId: string,
  statuses: DocumentDraftStatus[],
  options: {
    limit?: number;
    cursor?: string | null;
  } = {},
) {
  const take = Math.max(1, Math.min(options.limit ?? 25, 100));
  let where: Prisma.DocumentDraftWhereInput = {
    business_id: businessId,
    status: { in: statuses as never[] },
  };

  if (options.cursor) {
    const cursorRecord = await prisma.documentDraft.findFirst({
      where: {
        id: options.cursor,
        business_id: businessId,
      },
      select: { id: true, created_at: true },
    });

    if (!cursorRecord) {
      return {
        drafts: [] as DocumentDraft[],
        nextCursor: null as string | null,
      };
    }

    where = {
      ...where,
      OR: [
        { created_at: { lt: cursorRecord.created_at } },
        {
          created_at: cursorRecord.created_at,
          id: { lt: cursorRecord.id },
        },
      ],
    };
  }

  const rows = await prisma.documentDraft.findMany({
    where,
    take: take + 1,
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
  });

  const hasNextPage = rows.length > take;
  const drafts = hasNextPage ? rows.slice(0, take) : rows;
  const nextCursor = hasNextPage ? drafts[drafts.length - 1]?.id ?? null : null;

  return {
    drafts,
    nextCursor,
  };
}

export async function countDraftsByStatus(
  businessId: string,
  statuses: DocumentDraftStatus[],
) {
  return prisma.documentDraft.count({
    where: {
      business_id: businessId,
      status: { in: statuses as never[] },
    },
  });
}

export async function updateDraftStatus(
  businessId: string,
  draftId: string,
  status: DocumentDraftStatus,
) {
  const existing = await findDraftById(businessId, draftId);
  if (!existing) throw new Error("Document draft not found");

  return prisma.documentDraft.update({
    where: { id: draftId },
    data: { status },
  });
}

export async function updateDraftParsedFields(
  businessId: string,
  draftId: string,
  fields: DraftParsedFieldsUpdate,
) {
  const existing = await findDraftById(businessId, draftId);
  if (!existing) throw new Error("Document draft not found");

  const data: Prisma.DocumentDraftUpdateInput = {};
  if (fields.parsedVendorName !== undefined) {
    data.parsed_vendor_name = fields.parsedVendorName;
  }
  if (fields.parsedDate !== undefined) {
    data.parsed_date = fields.parsedDate;
  }
  if (fields.parsedTotal !== undefined) {
    data.parsed_total = toDecimalOrNull(fields.parsedTotal, 2);
  }
  if (fields.parsedTax !== undefined) {
    data.parsed_tax = toDecimalOrNull(fields.parsedTax, 2);
  }
  if (fields.parsedLineItems !== undefined) {
    data.parsed_line_items = fields.parsedLineItems ?? Prisma.DbNull;
  }
  if (fields.confidenceScore !== undefined) {
    data.confidence_score = toDecimalOrNull(fields.confidenceScore, 3);
  }
  if (fields.confidenceBand !== undefined) {
    data.confidence_band = fields.confidenceBand;
  }
  if (fields.parseFlags !== undefined) {
    data.parse_flags = fields.parseFlags ?? Prisma.DbNull;
  }
  if (fields.anomalyFlags !== undefined) {
    data.anomaly_flags = fields.anomalyFlags ?? Prisma.DbNull;
  }
  if (fields.status !== undefined) {
    data.status = fields.status;
  }

  return prisma.documentDraft.update({
    where: { id: draftId },
    data,
  });
}

export async function updateDraftVendorProfile(
  businessId: string,
  draftId: string,
  vendorProfileId: string | null,
) {
  const existing = await findDraftById(businessId, draftId);
  if (!existing) throw new Error("Document draft not found");

  return prisma.documentDraft.update({
    where: { id: draftId },
    data: {
      vendor_profile_id: vendorProfileId,
    },
  });
}

export async function updateDraftPostedState(
  businessId: string,
  draftId: string,
  state: DraftPostedStateUpdate,
) {
  const existing = await findDraftById(businessId, draftId);
  if (!existing) throw new Error("Document draft not found");

  return prisma.documentDraft.update({
    where: { id: draftId },
    data: {
      status: "posted",
      financial_transaction_id: state.financialTransactionId,
      posted_by_user_id: state.postedByUserId,
      posted_at: new Date(),
      auto_posted: state.autoPosted,
    },
  });
}

export async function updateDraftIngestArtifacts(
  businessId: string,
  draftId: string,
  data: DraftIngestArtifactsUpdate,
) {
  const existing = await findDraftById(businessId, draftId);
  if (!existing) throw new Error("Document draft not found");

  const updateData: Prisma.DocumentDraftUpdateInput = {
    raw_storage_path: data.rawStoragePath,
  };
  if (data.parseFlags !== undefined) {
    updateData.parse_flags = data.parseFlags ?? Prisma.DbNull;
  }

  return prisma.documentDraft.update({
    where: { id: draftId },
    data: updateData,
  });
}
