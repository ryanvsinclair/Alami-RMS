const DOCUMENT_DRAFT_STATUSES = [
  "received",
  "parsing",
  "draft",
  "pending_review",
  "posted",
  "rejected",
] as const;
type DocumentDraftStatus = (typeof DOCUMENT_DRAFT_STATUSES)[number];

type DraftInboxStatusFilter = DocumentDraftStatus | "all";

interface DraftReviewFilters {
  page?: number;
  pageSize?: number;
  statusFilter?: DraftInboxStatusFilter;
}

interface CreateDraftReviewServiceOptions {
  prismaClient?: DraftReviewPrismaClient;
}

interface DraftRecord {
  id: string;
  status: DocumentDraftStatus;
  confidence_band: "high" | "medium" | "low" | "none" | null;
  parsed_vendor_name: string | null;
  parsed_total: unknown;
  parsed_date: Date | null;
  parsed_line_items: unknown;
  auto_posted: boolean;
  created_at: Date;
  parse_flags: unknown;
  anomaly_flags: unknown;
  parsed_tax: unknown;
  confidence_score: unknown;
  posted_at: Date | null;
  posted_by_user_id: string | null;
  financial_transaction_id: string | null;
  inbound_channel: "email" | "webhook" | "manual_upload";
  raw_content_type: string;
  raw_storage_path: string;
  vendor_profile_id: string | null;
  vendor_profile: {
    id: string;
    vendor_name: string;
    trust_state: "unverified" | "learning" | "trusted" | "blocked";
    total_posted: number;
    trust_threshold_override: number | null;
    auto_post_enabled: boolean;
  } | null;
  financial_transaction: { id: string; created_at: Date } | null;
}

interface VendorProfileRecord {
  id: string;
  vendor_name: string;
  trust_state: "unverified" | "learning" | "trusted" | "blocked";
  total_posted: number;
  trust_threshold_override: number | null;
}

interface DocumentVendorItemMappingRecord {
  id: string;
  raw_line_item_name: string;
  inventory_item_id: string;
  confirmed_count: number;
  inventory_item: {
    id: string;
    name: string;
  };
}

interface DraftReviewPrismaClient {
  documentDraft: {
    findMany(args: unknown): Promise<DraftRecord[]>;
    count(args: unknown): Promise<number>;
    findFirst(args: unknown): Promise<DraftRecord | null>;
  };
  vendorProfile: {
    findMany(args: unknown): Promise<VendorProfileRecord[]>;
  };
  inventoryItem: {
    findMany(args: unknown): Promise<Array<{ id: string; name: string }>>;
  };
  documentVendorItemMapping: {
    findMany(args: unknown): Promise<DocumentVendorItemMappingRecord[]>;
  };
}

function toNumber(value: unknown) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && "toNumber" in (value as Record<string, unknown>)) {
    const candidate = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(candidate) ? candidate : null;
  }
  return null;
}

function toDateIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function toParsedLineItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  const items: Array<{
    description: string;
    quantity: number | null;
    unit_cost: number | null;
    line_total: number | null;
  }> = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const description =
      typeof record.description === "string" ? record.description.trim() : "";
    if (!description) continue;
    items.push({
      description,
      quantity: toNumber(record.quantity),
      unit_cost: toNumber(record.unit_cost),
      line_total: toNumber(record.line_total),
    });
  }
  return items;
}

function normalizeRawLineItemName(value: string) {
  return value.trim().toLowerCase();
}

function resolveStatusesForFilter(statusFilter?: DraftInboxStatusFilter): DocumentDraftStatus[] {
  if (!statusFilter) {
    return ["pending_review", "draft"];
  }
  if (statusFilter === "all") {
    return [...DOCUMENT_DRAFT_STATUSES];
  }
  return [statusFilter];
}

function toJsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function resolveSenderEmailFromParseFlags(parseFlags: unknown) {
  const parsed = toJsonRecord(parseFlags);
  const ingress = toJsonRecord(parsed.ingress);
  const senderEmail = ingress.sender_email;
  return typeof senderEmail === "string" ? senderEmail : null;
}

export function createDraftReviewService(options: CreateDraftReviewServiceOptions = {}) {
  const prismaClient = options.prismaClient;
  if (!prismaClient) {
    throw new Error("createDraftReviewService requires a prisma client");
  }
  const repositoryPrisma = prismaClient;

  async function getDraftInbox(
    businessId: string,
    filters: DraftReviewFilters = {},
  ) {
    const page = Math.max(1, Math.floor(filters.page ?? 1));
    const pageSize = Math.max(1, Math.min(Math.floor(filters.pageSize ?? 25), 100));
    const statuses = resolveStatusesForFilter(filters.statusFilter);

    const where = {
      business_id: businessId,
      status: {
        in: statuses,
      },
    };

    const [rows, total] = await Promise.all([
      repositoryPrisma.documentDraft.findMany({
        where,
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          vendor_profile: {
            select: {
              id: true,
              vendor_name: true,
            },
          },
        },
      }),
      repositoryPrisma.documentDraft.count({ where }),
    ]);

    return {
      page,
      pageSize,
      total,
      drafts: rows.map((draft) => ({
        id: draft.id,
        status: draft.status,
        confidence_band: draft.confidence_band,
        parsed_vendor_name: draft.parsed_vendor_name,
        parsed_total: toNumber(draft.parsed_total),
        parsed_date: toDateIso(draft.parsed_date),
        auto_posted: draft.auto_posted,
        created_at: draft.created_at.toISOString(),
        vendor_profile: draft.vendor_profile
          ? {
              id: draft.vendor_profile.id,
              vendor_name: draft.vendor_profile.vendor_name,
            }
          : null,
      })),
    };
  }

  async function getDraftInboxBadgeCount(businessId: string) {
    return repositoryPrisma.documentDraft.count({
      where: {
        business_id: businessId,
        status: {
          in: ["pending_review", "draft"],
        },
      },
    });
  }

  async function getDraftDetail(businessId: string, draftId: string) {
    const draft = await repositoryPrisma.documentDraft.findFirst({
      where: {
        id: draftId,
        business_id: businessId,
      },
      include: {
        vendor_profile: true,
        financial_transaction: {
          select: {
            id: true,
            created_at: true,
          },
        },
      },
    });
    if (!draft) return null;

    const parsedLineItems = toParsedLineItems(draft.parsed_line_items);

    const [vendorProfiles, inventoryItems, vendorMappings] = await Promise.all([
      repositoryPrisma.vendorProfile.findMany({
        where: { business_id: businessId },
        orderBy: [{ vendor_name: "asc" }],
      }),
      repositoryPrisma.inventoryItem.findMany({
        where: {
          business_id: businessId,
          is_active: true,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: [{ name: "asc" }],
      }),
      draft.vendor_profile_id
        ? repositoryPrisma.documentVendorItemMapping.findMany({
            where: {
              business_id: businessId,
              vendor_profile_id: draft.vendor_profile_id,
            },
            include: {
              inventory_item: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const mappingByRawName = new Map(
      vendorMappings.map((mapping) => [
        normalizeRawLineItemName(mapping.raw_line_item_name),
        {
          id: mapping.id,
          inventory_item_id: mapping.inventory_item_id,
          inventory_item_name: mapping.inventory_item.name,
          confirmed_count: mapping.confirmed_count,
        },
      ]),
    );

    let rawDocumentPreviewText: string | null = null;
    if (
      draft.raw_content_type.startsWith("text/") ||
      draft.raw_content_type.includes("json")
    ) {
      try {
        const { loadRawDocument } = await import("./document-storage.service");
        const rawDocument = await loadRawDocument(draft.raw_storage_path);
        rawDocumentPreviewText = rawDocument.content.toString("utf8");
      } catch {
        rawDocumentPreviewText = null;
      }
    }

    return {
      id: draft.id,
      status: draft.status,
      inbound_channel: draft.inbound_channel,
      raw_content_type: draft.raw_content_type,
      parsed_vendor_name: draft.parsed_vendor_name,
      parsed_date: toDateIso(draft.parsed_date),
      parsed_total: toNumber(draft.parsed_total),
      parsed_tax: toNumber(draft.parsed_tax),
      confidence_score: toNumber(draft.confidence_score),
      confidence_band: draft.confidence_band,
      parse_flags: draft.parse_flags,
      anomaly_flags: draft.anomaly_flags,
      auto_posted: draft.auto_posted,
      posted_at: toDateIso(draft.posted_at),
      posted_by_user_id: draft.posted_by_user_id,
      financial_transaction_id: draft.financial_transaction_id,
      financial_transaction_created_at: toDateIso(draft.financial_transaction?.created_at),
      raw_document_preview_text: rawDocumentPreviewText,
      sender_email: resolveSenderEmailFromParseFlags(draft.parse_flags),
      vendor_profile: draft.vendor_profile
        ? {
            id: draft.vendor_profile.id,
            vendor_name: draft.vendor_profile.vendor_name,
            trust_state: draft.vendor_profile.trust_state,
            total_posted: draft.vendor_profile.total_posted,
            trust_threshold_override: draft.vendor_profile.trust_threshold_override,
            auto_post_enabled: draft.vendor_profile.auto_post_enabled,
          }
        : null,
      vendor_profiles: vendorProfiles.map((vendor) => ({
        id: vendor.id,
        vendor_name: vendor.vendor_name,
        trust_state: vendor.trust_state,
        total_posted: vendor.total_posted,
        trust_threshold_override: vendor.trust_threshold_override,
      })),
      inventory_items: inventoryItems,
      line_items: parsedLineItems.map((lineItem) => {
        const mapping =
          mappingByRawName.get(normalizeRawLineItemName(lineItem.description)) ?? null;
        return {
          ...lineItem,
          mapped_inventory_item_id: mapping?.inventory_item_id ?? null,
          mapped_inventory_item_name: mapping?.inventory_item_name ?? null,
          mapping_confirmed_count: mapping?.confirmed_count ?? null,
        };
      }),
    };
  }

  async function getDraftDocumentUrl(businessId: string, draftId: string) {
    const draft = await repositoryPrisma.documentDraft.findFirst({
      where: {
        id: draftId,
        business_id: businessId,
      },
      select: {
        raw_storage_path: true,
      },
    });
    if (!draft) {
      throw new Error("Document draft not found");
    }
    const { getRawDocumentSignedUrl } = await import("./document-storage.service");
    return getRawDocumentSignedUrl(draft.raw_storage_path);
  }

  return {
    getDraftInbox,
    getDraftInboxBadgeCount,
    getDraftDetail,
    getDraftDocumentUrl,
  };
}

let defaultServicePromise:
  | Promise<ReturnType<typeof createDraftReviewService>>
  | null = null;

async function getDefaultService() {
  if (!defaultServicePromise) {
    defaultServicePromise = import("@/server/db/prisma").then(({ prisma }) =>
      createDraftReviewService({
        prismaClient: prisma as unknown as DraftReviewPrismaClient,
      }),
    );
  }
  return defaultServicePromise;
}

export async function getDraftInbox(
  businessId: string,
  filters: DraftReviewFilters = {},
) {
  const service = await getDefaultService();
  return service.getDraftInbox(businessId, filters);
}

export async function getDraftInboxBadgeCount(businessId: string) {
  const service = await getDefaultService();
  return service.getDraftInboxBadgeCount(businessId);
}

export async function getDraftDetail(businessId: string, draftId: string) {
  const service = await getDefaultService();
  return service.getDraftDetail(businessId, draftId);
}

export async function getDraftDocumentUrl(businessId: string, draftId: string) {
  const service = await getDefaultService();
  return service.getDraftDocumentUrl(businessId, draftId);
}
