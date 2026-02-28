const DOCUMENT_ANALYTICS_MIN_POSTED_DRAFTS = 20;

interface DocumentAnalyticsPeriodFilter {
  days?: 30 | 60 | 90;
  startDate?: string;
  endDate?: string;
}

interface VendorSpendSummaryResult {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  postedDraftCount: number;
  totalPostedDraftCount: number;
  minimumPostedDraftsRequired: number;
  minimumDataSatisfied: boolean;
  summary: Array<{
    vendorId: string;
    vendorName: string;
    totalSpend: number;
    draftCount: number;
  }>;
}

interface PriceTrendPoint {
  date: string;
  description: string;
  unitCost: number | null;
  lineTotal: number | null;
  quantity: number | null;
}

interface PriceTrendResult {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  vendorProfileId: string;
  availableItemNames: string[];
  points: PriceTrendPoint[];
}

interface ReorderSignalsResult {
  generatedAt: string;
  signals: Array<{
    inventoryItemId: string;
    inventoryItemName: string;
    lastPurchaseAt: string;
    avgPurchaseIntervalDays: number;
    daysSinceLastPurchase: number;
    estimatedDaysUntilReorder: number;
  }>;
}

interface TaxSummaryResult {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  postedDraftCount: number;
  totalTax: number;
  byVendor: Array<{
    vendorId: string;
    vendorName: string;
    taxTotal: number;
    draftCount: number;
  }>;
}

interface CogsSummaryResult {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  totalExpense: number;
  byCategory: Array<{
    categoryName: string;
    totalExpense: number;
  }>;
}

interface VendorProfileRecord {
  id: string;
  vendor_name: string;
  default_category: {
    id: string;
    name: string;
  } | null;
}

interface DocumentDraftRecord {
  id: string;
  business_id: string;
  vendor_profile_id: string | null;
  status: "received" | "parsing" | "draft" | "pending_review" | "posted" | "rejected";
  parsed_vendor_name: string | null;
  parsed_total: unknown;
  parsed_tax: unknown;
  parsed_date: Date | null;
  posted_at: Date | null;
  parsed_line_items: unknown;
  financial_transaction_id: string | null;
  vendor_profile: VendorProfileRecord | null;
}

interface DocumentVendorItemMappingRecord {
  raw_line_item_name: string;
}

interface InventoryTransactionRecord {
  inventory_item_id: string;
  created_at: Date;
}

interface InventoryItemRecord {
  id: string;
  name: string;
}

interface FinancialTransactionRecord {
  id: string;
  amount: unknown;
  metadata: unknown;
}

interface AnalyticsPrismaClient {
  documentDraft: {
    findMany(args: unknown): Promise<DocumentDraftRecord[]>;
    count(args: unknown): Promise<number>;
  };
  documentVendorItemMapping: {
    findMany(args: unknown): Promise<DocumentVendorItemMappingRecord[]>;
  };
  inventoryTransaction: {
    findMany(args: unknown): Promise<InventoryTransactionRecord[]>;
  };
  inventoryItem: {
    findMany(args: unknown): Promise<InventoryItemRecord[]>;
  };
  financialTransaction: {
    findMany(args: unknown): Promise<FinancialTransactionRecord[]>;
  };
  vendorProfile: {
    findMany(args: unknown): Promise<VendorProfileRecord[]>;
  };
}

interface CreateDocumentAnalyticsServiceOptions {
  prismaClient?: AnalyticsPrismaClient;
  now?: () => Date;
}

interface ParsedLineItemValue {
  description: string;
  quantity: number | null;
  unit_cost: number | null;
  line_total: number | null;
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

function toDate(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function toIso(value: Date) {
  return value.toISOString();
}

function normalizeLineItemName(value: string) {
  return value.trim().toLowerCase();
}

function toJsonRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toParsedLineItems(value: unknown) {
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
      unit_cost: toNumber(record.unit_cost),
      line_total: toNumber(record.line_total),
    });
  }

  return items;
}

function buildPeriodRange(period: DocumentAnalyticsPeriodFilter, now: () => Date) {
  const nowDate = now();
  const startDate = period.startDate ? toDate(period.startDate) : null;
  const endDate = period.endDate ? toDate(period.endDate) : null;

  if (startDate || endDate) {
    const fallbackStart = new Date(nowDate.getTime() - (90 * 24 * 60 * 60 * 1000));
    return {
      start: startDate ?? fallbackStart,
      end: endDate ?? nowDate,
      label: "custom",
    };
  }

  const days = period.days ?? 30;
  return {
    start: new Date(nowDate.getTime() - (days * 24 * 60 * 60 * 1000)),
    end: nowDate,
    label: `${days}d`,
  };
}

function isWithinRange(value: Date | null, start: Date, end: Date) {
  if (!value) return false;
  return value >= start && value <= end;
}

function formatErrorForThreshold(postedDraftCount: number) {
  return `Document analytics requires at least ${DOCUMENT_ANALYTICS_MIN_POSTED_DRAFTS} posted drafts. Current posted drafts: ${postedDraftCount}.`;
}

export function createDocumentAnalyticsService(
  options: CreateDocumentAnalyticsServiceOptions = {},
) {
  const prismaClient = options.prismaClient;
  if (!prismaClient) {
    throw new Error("createDocumentAnalyticsService requires a prisma client");
  }

  const repositoryPrisma = prismaClient;
  const now = options.now ?? (() => new Date());

  async function countPostedDrafts(businessId: string) {
    return repositoryPrisma.documentDraft.count({
      where: {
        business_id: businessId,
        status: "posted",
      },
    });
  }

  async function assertAnalyticsReady(businessId: string) {
    const postedDraftCount = await countPostedDrafts(businessId);
    if (postedDraftCount < DOCUMENT_ANALYTICS_MIN_POSTED_DRAFTS) {
      throw new Error(formatErrorForThreshold(postedDraftCount));
    }
    return postedDraftCount;
  }

  async function loadPostedDrafts(
    businessId: string,
    period: DocumentAnalyticsPeriodFilter = {},
  ) {
    const range = buildPeriodRange(period, now);
    const drafts = await repositoryPrisma.documentDraft.findMany({
      where: {
        business_id: businessId,
        status: "posted",
      },
      include: {
        vendor_profile: {
          include: {
            default_category: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [{ posted_at: "desc" }],
      take: 2000,
    });

    const filteredDrafts = drafts.filter((draft) => {
      const postedAt = toDate(draft.posted_at) ?? toDate(draft.parsed_date);
      return isWithinRange(postedAt, range.start, range.end);
    });

    return {
      drafts: filteredDrafts,
      range,
      postedDraftCount: filteredDrafts.length,
    };
  }

  async function getVendorSpendSummary(
    businessId: string,
    options: { period?: DocumentAnalyticsPeriodFilter } = {},
  ): Promise<VendorSpendSummaryResult> {
    const [allPostedDraftCount, { drafts, range, postedDraftCount }] = await Promise.all([
      countPostedDrafts(businessId),
      loadPostedDrafts(businessId, options.period),
    ]);

    const byVendor = new Map<string, { vendorName: string; total: number; draftCount: number }>();
    for (const draft of drafts) {
      const amount = toNumber(draft.parsed_total) ?? 0;
      const vendorId = draft.vendor_profile_id ?? "unlinked";
      const vendorName =
        draft.vendor_profile?.vendor_name ||
        draft.parsed_vendor_name ||
        "Unknown Vendor";

      const aggregate = byVendor.get(vendorId) ?? {
        vendorName,
        total: 0,
        draftCount: 0,
      };
      aggregate.total += amount;
      aggregate.draftCount += 1;
      byVendor.set(vendorId, aggregate);
    }

    const summary = Array.from(byVendor.entries())
      .map(([vendorId, aggregate]) => ({
        vendorId,
        vendorName: aggregate.vendorName,
        totalSpend: Number(aggregate.total.toFixed(2)),
        draftCount: aggregate.draftCount,
      }))
      .sort((left, right) => right.totalSpend - left.totalSpend);

    return {
      periodLabel: range.label,
      periodStart: toIso(range.start),
      periodEnd: toIso(range.end),
      postedDraftCount,
      totalPostedDraftCount: allPostedDraftCount,
      minimumPostedDraftsRequired: DOCUMENT_ANALYTICS_MIN_POSTED_DRAFTS,
      minimumDataSatisfied:
        allPostedDraftCount >= DOCUMENT_ANALYTICS_MIN_POSTED_DRAFTS,
      summary,
    };
  }

  async function getPriceTrends(
    businessId: string,
    vendorProfileId: string,
    options: {
      period?: DocumentAnalyticsPeriodFilter;
      inventoryItemId?: string;
      rawLineItemName?: string;
    } = {},
  ): Promise<PriceTrendResult> {
    await assertAnalyticsReady(businessId);
    const { drafts, range } = await loadPostedDrafts(businessId, options.period);

    const vendorDrafts = drafts.filter(
      (draft) => draft.vendor_profile_id === vendorProfileId,
    );

    let allowedRawNames: Set<string> | null = null;
    if (options.inventoryItemId) {
      const mappings = await repositoryPrisma.documentVendorItemMapping.findMany({
        where: {
          business_id: businessId,
          vendor_profile_id: vendorProfileId,
          inventory_item_id: options.inventoryItemId,
        },
        select: {
          raw_line_item_name: true,
        },
      });
      allowedRawNames = new Set(
        mappings
          .map((mapping) => normalizeLineItemName(mapping.raw_line_item_name))
          .filter((value) => value.length > 0),
      );
    }

    const rawFilter = options.rawLineItemName
      ? normalizeLineItemName(options.rawLineItemName)
      : null;

    const availableItemNames = new Set<string>();
    const points: PriceTrendPoint[] = [];

    for (const draft of vendorDrafts) {
      const postedAt = toDate(draft.posted_at) ?? toDate(draft.parsed_date);
      if (!postedAt) continue;

      const lineItems = toParsedLineItems(draft.parsed_line_items);
      for (const lineItem of lineItems) {
        const normalized = normalizeLineItemName(lineItem.description);
        if (!normalized) continue;

        availableItemNames.add(lineItem.description);
        if (rawFilter && normalized !== rawFilter) continue;
        if (allowedRawNames && !allowedRawNames.has(normalized)) continue;

        points.push({
          date: toIso(postedAt),
          description: lineItem.description,
          unitCost: lineItem.unit_cost,
          lineTotal: lineItem.line_total,
          quantity: lineItem.quantity,
        });
      }
    }

    points.sort((left, right) => left.date.localeCompare(right.date));

    return {
      periodLabel: range.label,
      periodStart: toIso(range.start),
      periodEnd: toIso(range.end),
      vendorProfileId,
      availableItemNames: Array.from(availableItemNames.values()).sort((left, right) =>
        left.localeCompare(right),
      ),
      points,
    };
  }

  async function getReorderSignals(businessId: string): Promise<ReorderSignalsResult> {
    await assertAnalyticsReady(businessId);

    const nowDate = now();
    const windowStart = new Date(nowDate.getTime() - (180 * 24 * 60 * 60 * 1000));

    const [transactions, inventoryItems] = await Promise.all([
      repositoryPrisma.inventoryTransaction.findMany({
        where: {
          business_id: businessId,
          transaction_type: "purchase",
          input_method: "receipt",
          created_at: {
            gte: windowStart,
          },
        },
        orderBy: [{ created_at: "desc" }],
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
      }),
    ]);

    const itemNameById = new Map(
      inventoryItems.map((item) => [item.id, item.name]),
    );

    const purchasesByItem = new Map<string, Date[]>();
    for (const transaction of transactions) {
      const itemId = transaction.inventory_item_id;
      const createdAt = toDate(transaction.created_at);
      if (!itemId || !createdAt) continue;

      const bucket = purchasesByItem.get(itemId) ?? [];
      bucket.push(createdAt);
      purchasesByItem.set(itemId, bucket);
    }

    const signals = [] as ReorderSignalsResult["signals"];
    for (const [itemId, purchaseDates] of purchasesByItem.entries()) {
      if (purchaseDates.length < 2) continue;

      const sortedDates = purchaseDates
        .slice()
        .sort((left, right) => left.getTime() - right.getTime());

      const intervalsInDays: number[] = [];
      for (let index = 1; index < sortedDates.length; index += 1) {
        const diffDays =
          (sortedDates[index].getTime() - sortedDates[index - 1].getTime()) /
          (24 * 60 * 60 * 1000);
        if (diffDays > 0) intervalsInDays.push(diffDays);
      }
      if (!intervalsInDays.length) continue;

      const avgIntervalDays =
        intervalsInDays.reduce((total, value) => total + value, 0) /
        intervalsInDays.length;
      const lastPurchaseAt = sortedDates[sortedDates.length - 1];
      const daysSinceLastPurchase =
        (nowDate.getTime() - lastPurchaseAt.getTime()) / (24 * 60 * 60 * 1000);
      const estimatedDaysUntilReorder = Math.max(
        0,
        Math.round(avgIntervalDays - daysSinceLastPurchase),
      );
      if (estimatedDaysUntilReorder > 7) continue;

      signals.push({
        inventoryItemId: itemId,
        inventoryItemName: itemNameById.get(itemId) ?? "Unknown Item",
        lastPurchaseAt: toIso(lastPurchaseAt),
        avgPurchaseIntervalDays: Number(avgIntervalDays.toFixed(1)),
        daysSinceLastPurchase: Number(daysSinceLastPurchase.toFixed(1)),
        estimatedDaysUntilReorder,
      });
    }

    signals.sort(
      (left, right) => left.estimatedDaysUntilReorder - right.estimatedDaysUntilReorder,
    );

    return {
      generatedAt: toIso(nowDate),
      signals,
    };
  }

  async function getTaxSummary(
    businessId: string,
    options: { period?: DocumentAnalyticsPeriodFilter } = {},
  ): Promise<TaxSummaryResult> {
    await assertAnalyticsReady(businessId);

    const { drafts, range } = await loadPostedDrafts(businessId, options.period);
    const relatedTransactions = await repositoryPrisma.financialTransaction.findMany({
      where: {
        business_id: businessId,
        source: "document_intake",
        type: "expense",
        occurred_at: {
          gte: range.start,
          lte: range.end,
        },
      },
      select: {
        id: true,
      },
    });
    const linkedTransactionIds = new Set(
      relatedTransactions.map((transaction) => transaction.id),
    );

    const eligibleDrafts = drafts.filter(
      (draft) =>
        !!draft.financial_transaction_id &&
        linkedTransactionIds.has(draft.financial_transaction_id),
    );

    const byVendor = new Map<string, { vendorName: string; taxTotal: number; draftCount: number }>();
    let totalTax = 0;

    for (const draft of eligibleDrafts) {
      const tax = toNumber(draft.parsed_tax) ?? 0;
      totalTax += tax;

      const vendorId = draft.vendor_profile_id ?? "unlinked";
      const vendorName =
        draft.vendor_profile?.vendor_name ||
        draft.parsed_vendor_name ||
        "Unknown Vendor";

      const aggregate = byVendor.get(vendorId) ?? {
        vendorName,
        taxTotal: 0,
        draftCount: 0,
      };
      aggregate.taxTotal += tax;
      aggregate.draftCount += 1;
      byVendor.set(vendorId, aggregate);
    }

    return {
      periodLabel: range.label,
      periodStart: toIso(range.start),
      periodEnd: toIso(range.end),
      postedDraftCount: eligibleDrafts.length,
      totalTax: Number(totalTax.toFixed(2)),
      byVendor: Array.from(byVendor.entries())
        .map(([vendorId, aggregate]) => ({
          vendorId,
          vendorName: aggregate.vendorName,
          taxTotal: Number(aggregate.taxTotal.toFixed(2)),
          draftCount: aggregate.draftCount,
        }))
        .sort((left, right) => right.taxTotal - left.taxTotal),
    };
  }

  async function getCogsSummary(
    businessId: string,
    options: { period?: DocumentAnalyticsPeriodFilter } = {},
  ): Promise<CogsSummaryResult> {
    await assertAnalyticsReady(businessId);

    const range = buildPeriodRange(options.period ?? {}, now);
    const [transactions, vendorProfiles] = await Promise.all([
      repositoryPrisma.financialTransaction.findMany({
        where: {
          business_id: businessId,
          source: "document_intake",
          type: "expense",
          occurred_at: {
            gte: range.start,
            lte: range.end,
          },
        },
        orderBy: [{ occurred_at: "desc" }],
      }),
      repositoryPrisma.vendorProfile.findMany({
        where: {
          business_id: businessId,
        },
        include: {
          default_category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const vendorCategoryById = new Map(
      vendorProfiles.map((vendorProfile) => [
        vendorProfile.id,
        vendorProfile.default_category?.name || "Uncategorized",
      ]),
    );

    const byCategory = new Map<string, number>();
    let totalExpense = 0;

    for (const transaction of transactions) {
      const amount = toNumber(transaction.amount) ?? 0;
      totalExpense += amount;

      const metadata = toJsonRecord(transaction.metadata);
      const vendorProfileId =
        typeof metadata.vendor_profile_id === "string"
          ? metadata.vendor_profile_id
          : null;

      const categoryName = vendorProfileId
        ? (vendorCategoryById.get(vendorProfileId) ?? "Uncategorized")
        : "Uncategorized";

      byCategory.set(categoryName, (byCategory.get(categoryName) ?? 0) + amount);
    }

    return {
      periodLabel: range.label,
      periodStart: toIso(range.start),
      periodEnd: toIso(range.end),
      totalExpense: Number(totalExpense.toFixed(2)),
      byCategory: Array.from(byCategory.entries())
        .map(([categoryName, amount]) => ({
          categoryName,
          totalExpense: Number(amount.toFixed(2)),
        }))
        .sort((left, right) => right.totalExpense - left.totalExpense),
    };
  }

  return {
    getVendorSpendSummary,
    getPriceTrends,
    getReorderSignals,
    getTaxSummary,
    getCogsSummary,
  };
}

let defaultServicePromise:
  | Promise<ReturnType<typeof createDocumentAnalyticsService>>
  | null = null;

async function getDefaultService() {
  if (!defaultServicePromise) {
    defaultServicePromise = import("@/server/db/prisma").then(({ prisma }) =>
      createDocumentAnalyticsService({
        prismaClient: prisma as unknown as AnalyticsPrismaClient,
      }),
    );
  }
  return defaultServicePromise;
}

export async function getVendorSpendSummary(
  businessId: string,
  options: { period?: DocumentAnalyticsPeriodFilter } = {},
) {
  const service = await getDefaultService();
  return service.getVendorSpendSummary(businessId, options);
}

export async function getPriceTrends(
  businessId: string,
  vendorProfileId: string,
  options: {
    period?: DocumentAnalyticsPeriodFilter;
    inventoryItemId?: string;
    rawLineItemName?: string;
  } = {},
) {
  const service = await getDefaultService();
  return service.getPriceTrends(businessId, vendorProfileId, options);
}

export async function getReorderSignals(businessId: string) {
  const service = await getDefaultService();
  return service.getReorderSignals(businessId);
}

export async function getTaxSummary(
  businessId: string,
  options: { period?: DocumentAnalyticsPeriodFilter } = {},
) {
  const service = await getDefaultService();
  return service.getTaxSummary(businessId, options);
}

export async function getCogsSummary(
  businessId: string,
  options: { period?: DocumentAnalyticsPeriodFilter } = {},
) {
  const service = await getDefaultService();
  return service.getCogsSummary(businessId, options);
}
