const DEFAULT_VENDOR_TRUST_THRESHOLD = 5;

type DraftStatus = "received" | "parsing" | "draft" | "pending_review" | "posted" | "rejected";

interface DocumentDraftRecord {
  id: string;
  business_id: string;
  status: DraftStatus;
  financial_transaction_id: string | null;
  vendor_profile_id: string | null;
  parsed_line_items: unknown;
  parsed_date: Date | null;
  parsed_total: unknown;
  parsed_vendor_name: string | null;
}

interface VendorProfileRecord {
  id: string;
  business_id: string;
  trust_state: "unverified" | "learning" | "trusted" | "blocked";
  total_posted: number;
  trust_threshold_override: number | null;
  auto_post_enabled: boolean;
  trust_threshold_met_at: Date | null;
  last_document_at: Date | null;
}

interface DocumentPostTransactionClient {
  documentDraft: {
    findFirst(args: unknown): Promise<DocumentDraftRecord | null>;
    update(args: unknown): Promise<DocumentDraftRecord>;
  };
  financialTransaction: {
    upsert(args: unknown): Promise<{ id: string }>;
  };
  documentVendorItemMapping: {
    findFirst(args: unknown): Promise<{ inventory_item_id: string } | null>;
  };
  inventoryTransaction: {
    create(args: unknown): Promise<unknown>;
  };
  vendorProfile: {
    findFirst(args: unknown): Promise<VendorProfileRecord | null>;
    update(args: unknown): Promise<VendorProfileRecord>;
  };
}

interface DocumentPostPrismaClient {
  $transaction: <T>(
    callback: (tx: DocumentPostTransactionClient) => Promise<T>,
  ) => Promise<T>;
  documentDraft: {
    findFirst(args: unknown): Promise<DocumentDraftRecord | null>;
    update(args: unknown): Promise<DocumentDraftRecord>;
  };
}

interface ParsedLineItemValue {
  description: string;
  quantity: number | null;
  unitCost: number | null;
  lineTotal: number | null;
}

interface CreateDocumentPostServiceOptions {
  prismaClient?: DocumentPostPrismaClient;
  globalTrustThreshold?: number;
  now?: () => Date;
}

export interface PostDraftResult {
  financialTransactionId: string;
  inventoryTransactionsCreated: number;
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

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeRawLineItemName(value: string) {
  return value.trim().toLowerCase();
}

function toParsedLineItems(value: unknown): ParsedLineItemValue[] {
  if (!Array.isArray(value)) return [];
  const items: ParsedLineItemValue[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const description =
      typeof record.description === "string" ? record.description.trim() : "";
    if (!description) continue;

    items.push({
      description,
      quantity: toNumber(record.quantity),
      unitCost: toNumber(record.unit_cost),
      lineTotal: toNumber(record.line_total),
    });
  }
  return items;
}

function getQuantity(value: number | null) {
  if (value == null || !Number.isFinite(value) || value <= 0) return 1;
  return value;
}

function getLineCosts(item: ParsedLineItemValue) {
  const quantity = getQuantity(item.quantity);
  const lineTotal =
    item.lineTotal != null ? roundMoney(item.lineTotal) : null;
  const unitCost =
    item.unitCost != null
      ? roundMoney(item.unitCost)
      : lineTotal != null
        ? roundMoney(lineTotal / quantity)
        : null;

  const normalizedLineTotal =
    lineTotal ?? (unitCost != null ? roundMoney(unitCost * quantity) : null);

  return {
    quantity,
    unitCost,
    lineTotal: normalizedLineTotal,
  };
}

function isRejectableStatus(status: DraftStatus) {
  return status === "pending_review" || status === "draft";
}

function getEffectiveTrustThreshold(
  trustThresholdOverride: number | null,
  globalTrustThreshold: number,
) {
  return trustThresholdOverride ?? globalTrustThreshold;
}

export function createDocumentPostService(options: CreateDocumentPostServiceOptions = {}) {
  const prismaClient = options.prismaClient;
  if (!prismaClient) {
    throw new Error("createDocumentPostService requires a prisma client");
  }
  const repositoryPrisma = prismaClient;
  const globalTrustThreshold = options.globalTrustThreshold ?? DEFAULT_VENDOR_TRUST_THRESHOLD;
  const now = options.now ?? (() => new Date());

  async function postDraft(
    businessId: string,
    draftId: string,
    userId: string,
    postOptions: { autoPosted?: boolean } = {},
  ): Promise<PostDraftResult> {
    return repositoryPrisma.$transaction(async (tx) => {
      const draft = await tx.documentDraft.findFirst({
        where: {
          id: draftId,
          business_id: businessId,
        },
      });
      if (!draft) {
        throw new Error("Document draft not found");
      }

      if (draft.financial_transaction_id) {
        return {
          financialTransactionId: draft.financial_transaction_id,
          inventoryTransactionsCreated: 0,
        };
      }

      if (draft.status !== "pending_review") {
        throw new Error("Only pending_review document drafts can be posted");
      }

      const parsedLineItems = toParsedLineItems(draft.parsed_line_items);
      const occurredAt = draft.parsed_date ?? now();
      const amount = toNumber(draft.parsed_total) ?? 0;
      const description = draft.parsed_vendor_name?.trim() || "Unknown Vendor";

      const financialTransaction = await tx.financialTransaction.upsert({
        where: {
          business_id_source_external_id: {
            business_id: businessId,
            source: "document_intake",
            external_id: draftId,
          },
        },
        create: {
          business_id: businessId,
          type: "expense",
          source: "document_intake",
          amount,
          occurred_at: occurredAt,
          description,
          external_id: draftId,
          metadata: {
            draft_id: draftId,
            vendor_profile_id: draft.vendor_profile_id,
            line_item_count: parsedLineItems.length,
          } as never,
        },
        update: {},
      });

      let inventoryTransactionsCreated = 0;
      if (draft.vendor_profile_id) {
        for (const lineItem of parsedLineItems) {
          const normalizedLineName = normalizeRawLineItemName(lineItem.description);
          if (!normalizedLineName) continue;

          const mapping = await tx.documentVendorItemMapping.findFirst({
            where: {
              business_id: businessId,
              vendor_profile_id: draft.vendor_profile_id,
              raw_line_item_name: normalizedLineName,
            },
          });
          if (!mapping) continue;

          const costs = getLineCosts(lineItem);
          await tx.inventoryTransaction.create({
            data: {
              business_id: businessId,
              inventory_item_id: mapping.inventory_item_id,
              transaction_type: "purchase",
              quantity: costs.quantity,
              unit: "each",
              unit_cost: costs.unitCost,
              total_cost: costs.lineTotal,
              input_method: "receipt",
              source: description,
              raw_data: {
                document_draft_id: draftId,
                vendor_profile_id: draft.vendor_profile_id,
                raw_line_item_name: normalizedLineName,
              } as never,
            },
          });
          inventoryTransactionsCreated += 1;
        }
      }

      await tx.documentDraft.update({
        where: { id: draft.id },
        data: {
          status: "posted",
          financial_transaction_id: financialTransaction.id,
          posted_at: now(),
          posted_by_user_id: userId,
          auto_posted: postOptions.autoPosted ?? false,
        },
      });

      if (draft.vendor_profile_id) {
        const vendorBeforeUpdate = await tx.vendorProfile.findFirst({
          where: {
            id: draft.vendor_profile_id,
            business_id: businessId,
          },
        });

        if (vendorBeforeUpdate) {
          const vendorAfterIncrement = await tx.vendorProfile.update({
            where: { id: vendorBeforeUpdate.id },
            data: {
              total_posted: { increment: 1 },
              last_document_at: now(),
            },
          });

          if (vendorAfterIncrement.trust_state !== "blocked") {
            const effectiveThreshold = getEffectiveTrustThreshold(
              vendorAfterIncrement.trust_threshold_override,
              globalTrustThreshold,
            );

            if (
              vendorAfterIncrement.total_posted >= effectiveThreshold &&
              vendorAfterIncrement.trust_state !== "trusted"
            ) {
              await tx.vendorProfile.update({
                where: { id: vendorAfterIncrement.id },
                data: {
                  trust_state: "trusted",
                  auto_post_enabled: true,
                  trust_threshold_met_at:
                    vendorAfterIncrement.trust_threshold_met_at ?? now(),
                },
              });
            } else if (
              vendorAfterIncrement.total_posted > 0 &&
              vendorAfterIncrement.trust_state === "unverified"
            ) {
              await tx.vendorProfile.update({
                where: { id: vendorAfterIncrement.id },
                data: {
                  trust_state: "learning",
                },
              });
            }
          }
        }
      }

      return {
        financialTransactionId: financialTransaction.id,
        inventoryTransactionsCreated,
      };
    });
  }

  async function rejectDraft(
    businessId: string,
    draftId: string,
    userId: string,
  ) {
    const draft = await repositoryPrisma.documentDraft.findFirst({
      where: {
        id: draftId,
        business_id: businessId,
      },
    });
    if (!draft) {
      throw new Error("Document draft not found");
    }
    if (!isRejectableStatus(draft.status as DraftStatus)) {
      throw new Error("Only pending_review or draft documents can be rejected");
    }

    return repositoryPrisma.documentDraft.update({
      where: { id: draft.id },
      data: {
        status: "rejected",
        posted_by_user_id: userId,
      },
    });
  }

  return {
    postDraft,
    rejectDraft,
  };
}

let defaultServicePromise:
  | Promise<ReturnType<typeof createDocumentPostService>>
  | null = null;

async function getDefaultService() {
  if (!defaultServicePromise) {
    defaultServicePromise = import("@/server/db/prisma").then(({ prisma }) =>
      createDocumentPostService({
        prismaClient: prisma as unknown as DocumentPostPrismaClient,
      }),
    );
  }
  return defaultServicePromise;
}

export async function postDraft(
  businessId: string,
  draftId: string,
  userId: string,
  postOptions: { autoPosted?: boolean } = {},
) {
  const service = await getDefaultService();
  return service.postDraft(businessId, draftId, userId, postOptions);
}

export async function rejectDraft(
  businessId: string,
  draftId: string,
  userId: string,
) {
  const service = await getDefaultService();
  return service.rejectDraft(businessId, draftId, userId);
}
