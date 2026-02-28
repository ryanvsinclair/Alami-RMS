const DEFAULT_AUTO_POST_CONFIDENCE_MIN = 0.85;
const DEFAULT_GLOBAL_TRUST_THRESHOLD = 5;
const DEFAULT_SYSTEM_USER_ID = "system:auto-post";

interface TrustPostDraftResult {
  financialTransactionId: string;
  inventoryTransactionsCreated: number;
}

export type DocumentAnomalyFlag =
  | "large_total"
  | "new_format"
  | "vendor_name_mismatch"
  | "unusual_line_count"
  | "duplicate_suspected";

interface VendorProfileRecord {
  id: string;
  business_id: string;
  vendor_name: string;
  trust_state: "unverified" | "learning" | "trusted" | "blocked";
  total_posted: number;
  trust_threshold_override: number | null;
  auto_post_enabled: boolean;
}

interface DocumentDraftRecord {
  id: string;
  business_id: string;
  vendor_profile_id: string | null;
  status: "received" | "parsing" | "draft" | "pending_review" | "posted" | "rejected";
  parsed_vendor_name: string | null;
  parsed_date: Date | null;
  parsed_total: unknown;
  parsed_line_items: unknown;
  confidence_score: unknown;
  anomaly_flags: unknown;
}

interface TrustPrismaClient {
  documentDraft: {
    findFirst(args: unknown): Promise<DocumentDraftRecord | null>;
    findMany(args: unknown): Promise<DocumentDraftRecord[]>;
    update(args: unknown): Promise<DocumentDraftRecord>;
  };
  vendorProfile: {
    findFirst(args: unknown): Promise<VendorProfileRecord | null>;
    update(args: unknown): Promise<VendorProfileRecord>;
  };
}

interface ParsedDraftFieldsForAnomaly {
  vendorName: string | null;
  parsedDate: Date | null;
  parsedTotal: number | null;
  confidenceScore: number | null;
  parsedLineItems: Array<{
    description: string;
    quantity: number | null;
    unit_cost: number | null;
    line_total: number | null;
  }>;
}

export interface AutoPostEligibilityResult {
  eligible: boolean;
  reason:
    | null
    | "vendor_blocked"
    | "auto_post_disabled"
    | "below_trust_threshold"
    | "low_confidence"
    | "anomaly_detected";
}

export interface AttemptAutoPostResult {
  autoPosted: boolean;
  reason: string | null;
  anomalyFlags: DocumentAnomalyFlag[];
  postResult: TrustPostDraftResult | null;
}

interface CreateTrustServiceOptions {
  prismaClient?: TrustPrismaClient;
  autoPostConfidenceMin?: number;
  globalTrustThreshold?: number;
  systemUserId?: string;
  now?: () => Date;
  postDraftFn?: (
    businessId: string,
    draftId: string,
    userId: string,
    options?: { autoPosted?: boolean },
  ) => Promise<TrustPostDraftResult>;
}

async function defaultPostDraftFn(
  businessId: string,
  draftId: string,
  userId: string,
  options: { autoPosted?: boolean } = {},
) {
  const postModule = await import("./document-post.service");
  const candidate = (postModule as Record<string, unknown>).postDraft;
  if (typeof candidate !== "function") {
    throw new Error("postDraft function is unavailable");
  }
  return (
    candidate as (
      businessId: string,
      draftId: string,
      userId: string,
      options?: { autoPosted?: boolean },
    ) => Promise<TrustPostDraftResult>
  )(businessId, draftId, userId, options);
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

function toJsonArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value;
}

function toParsedLineItems(value: unknown) {
  const items: ParsedDraftFieldsForAnomaly["parsedLineItems"] = [];
  for (const rawItem of toJsonArray(value)) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) continue;
    const record = rawItem as Record<string, unknown>;
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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

function getEffectiveTrustThreshold(
  vendorProfile: Pick<VendorProfileRecord, "trust_threshold_override">,
  globalTrustThreshold: number,
) {
  return vendorProfile.trust_threshold_override ?? globalTrustThreshold;
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((left, right) => left - right);
  const index = Math.ceil(ratio * sorted.length) - 1;
  const clampedIndex = Math.max(0, Math.min(index, sorted.length - 1));
  return sorted[clampedIndex];
}

function diceSimilarity(leftRaw: string | null, rightRaw: string | null) {
  const left = normalizeText(leftRaw);
  const right = normalizeText(rightRaw);
  if (!left || !right) return 1;
  if (left === right) return 1;

  const makeBigrams = (value: string) => {
    const map = new Map<string, number>();
    for (let index = 0; index < value.length - 1; index += 1) {
      const gram = value.slice(index, index + 2);
      map.set(gram, (map.get(gram) ?? 0) + 1);
    }
    return map;
  };

  const leftBigrams = makeBigrams(left);
  const rightBigrams = makeBigrams(right);
  let overlap = 0;

  for (const [gram, count] of leftBigrams.entries()) {
    overlap += Math.min(count, rightBigrams.get(gram) ?? 0);
  }

  const leftCount = Array.from(leftBigrams.values()).reduce((sum, count) => sum + count, 0);
  const rightCount = Array.from(rightBigrams.values()).reduce((sum, count) => sum + count, 0);
  if (leftCount + rightCount === 0) return 1;
  return (2 * overlap) / (leftCount + rightCount);
}

function parseDraftFields(draft: DocumentDraftRecord): ParsedDraftFieldsForAnomaly {
  return {
    vendorName: draft.parsed_vendor_name,
    parsedDate: draft.parsed_date,
    parsedTotal: toNumber(draft.parsed_total),
    confidenceScore: toNumber(draft.confidence_score),
    parsedLineItems: toParsedLineItems(draft.parsed_line_items),
  };
}

export function createTrustService(options: CreateTrustServiceOptions = {}) {
  const prismaClient = options.prismaClient;
  if (!prismaClient) {
    throw new Error("createTrustService requires a prisma client");
  }
  const repositoryPrisma = prismaClient;

  const autoPostConfidenceMin =
    options.autoPostConfidenceMin ?? DEFAULT_AUTO_POST_CONFIDENCE_MIN;
  const globalTrustThreshold =
    options.globalTrustThreshold ?? DEFAULT_GLOBAL_TRUST_THRESHOLD;
  const systemUserId = options.systemUserId ?? DEFAULT_SYSTEM_USER_ID;
  const now = options.now ?? (() => new Date());
  const postDraftFn = options.postDraftFn ?? defaultPostDraftFn;

  async function computeAnomalyFlags(
    businessId: string,
    vendorProfileId: string,
    parsedFields: ParsedDraftFieldsForAnomaly,
  ): Promise<DocumentAnomalyFlag[]> {
    const vendorProfile = await repositoryPrisma.vendorProfile.findFirst({
      where: {
        id: vendorProfileId,
        business_id: businessId,
      },
    });
    if (!vendorProfile) return [];

    const anomalyFlags: DocumentAnomalyFlag[] = [];
    const windowStart = new Date(now().getTime() - (30 * 24 * 60 * 60 * 1000));
    const historicalDrafts = await repositoryPrisma.documentDraft.findMany({
      where: {
        business_id: businessId,
        vendor_profile_id: vendorProfileId,
        status: "posted",
        parsed_date: {
          gte: windowStart,
        },
      },
      orderBy: [{ parsed_date: "desc" }],
      take: 200,
    });

    const historicalTotals = historicalDrafts
      .map((entry) => toNumber(entry.parsed_total))
      .filter((value): value is number => value != null);
    const currentTotal = parsedFields.parsedTotal;

    if (historicalTotals.length >= 5 && currentTotal != null) {
      const p95 = percentile(historicalTotals, 0.95);
      if (p95 != null && currentTotal > p95) {
        anomalyFlags.push("large_total");
      }
    }

    if (parsedFields.confidenceScore != null &&
      parsedFields.confidenceScore < 0.7 &&
      vendorProfile.total_posted >= 3) {
      anomalyFlags.push("new_format");
    }

    const vendorSimilarity = diceSimilarity(
      parsedFields.vendorName,
      vendorProfile.vendor_name,
    );
    if (1 - vendorSimilarity > 0.3) {
      anomalyFlags.push("vendor_name_mismatch");
    }

    const historicalLineCounts = historicalDrafts
      .map((entry) => toParsedLineItems(entry.parsed_line_items).length)
      .filter((value) => value > 0);
    if (historicalLineCounts.length >= 3) {
      const averageLineCount =
        historicalLineCounts.reduce((sum, value) => sum + value, 0) / historicalLineCounts.length;
      const currentLineCount = parsedFields.parsedLineItems.length;
      if (averageLineCount > 0) {
        const deltaRatio = Math.abs(currentLineCount - averageLineCount) / averageLineCount;
        if (deltaRatio > 0.5) {
          anomalyFlags.push("unusual_line_count");
        }
      }
    }

    if (parsedFields.parsedTotal != null && parsedFields.parsedDate != null) {
      const duplicateWindowStart = new Date(parsedFields.parsedDate.getTime() - (7 * 24 * 60 * 60 * 1000));
      const duplicateWindowEnd = new Date(parsedFields.parsedDate.getTime() + (7 * 24 * 60 * 60 * 1000));

      const duplicateCandidates = historicalDrafts.filter((entry) => {
        const draftTotal = toNumber(entry.parsed_total);
        if (draftTotal == null) return false;
        if (Math.abs(draftTotal - parsedFields.parsedTotal!) > 0.0001) return false;
        if (!entry.parsed_date) return false;
        return (
          entry.parsed_date >= duplicateWindowStart &&
          entry.parsed_date <= duplicateWindowEnd
        );
      });

      if (duplicateCandidates.length > 0) {
        anomalyFlags.push("duplicate_suspected");
      }
    }

    return Array.from(new Set(anomalyFlags));
  }

  function evaluateAutoPostEligibility(
    vendorProfile: VendorProfileRecord,
    draft: Pick<DocumentDraftRecord, "confidence_score" | "anomaly_flags">,
  ): AutoPostEligibilityResult {
    if (vendorProfile.trust_state === "blocked") {
      return { eligible: false, reason: "vendor_blocked" };
    }
    if (!vendorProfile.auto_post_enabled) {
      return { eligible: false, reason: "auto_post_disabled" };
    }

    const effectiveThreshold = getEffectiveTrustThreshold(
      vendorProfile,
      globalTrustThreshold,
    );
    if (vendorProfile.total_posted < effectiveThreshold) {
      return { eligible: false, reason: "below_trust_threshold" };
    }

    const confidenceScore = toNumber(draft.confidence_score) ?? 0;
    if (confidenceScore < autoPostConfidenceMin) {
      return { eligible: false, reason: "low_confidence" };
    }

    const anomalyFlags = toStringArray(draft.anomaly_flags);
    if (anomalyFlags.length > 0) {
      return { eligible: false, reason: "anomaly_detected" };
    }

    return { eligible: true, reason: null };
  }

  async function attemptAutoPost(
    businessId: string,
    draftId: string,
  ): Promise<AttemptAutoPostResult> {
    const draft = await repositoryPrisma.documentDraft.findFirst({
      where: {
        id: draftId,
        business_id: businessId,
      },
    });
    if (!draft) {
      return {
        autoPosted: false,
        reason: "draft_not_found",
        anomalyFlags: [],
        postResult: null,
      };
    }

    if (!draft.vendor_profile_id) {
      await repositoryPrisma.documentDraft.update({
        where: { id: draft.id },
        data: { status: "pending_review" },
      });
      return {
        autoPosted: false,
        reason: "vendor_unlinked",
        anomalyFlags: [],
        postResult: null,
      };
    }

    const vendorProfile = await repositoryPrisma.vendorProfile.findFirst({
      where: {
        id: draft.vendor_profile_id,
        business_id: businessId,
      },
    });
    if (!vendorProfile) {
      await repositoryPrisma.documentDraft.update({
        where: { id: draft.id },
        data: { status: "pending_review" },
      });
      return {
        autoPosted: false,
        reason: "vendor_unlinked",
        anomalyFlags: [],
        postResult: null,
      };
    }

    const parsedFields = parseDraftFields(draft);
    const anomalyFlags = await computeAnomalyFlags(
      businessId,
      vendorProfile.id,
      parsedFields,
    );

    await repositoryPrisma.documentDraft.update({
      where: { id: draft.id },
      data: {
        anomaly_flags: anomalyFlags as never,
      },
    });

    const eligibility = evaluateAutoPostEligibility(vendorProfile, {
      confidence_score: draft.confidence_score,
      anomaly_flags: anomalyFlags,
    });

    console.info("[documents/trust] auto_post_attempt", {
      event: "auto_post_attempt",
      businessId,
      draftId,
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      anomalyFlags,
      attemptedAt: now().toISOString(),
    });

    if (!eligibility.eligible) {
      await repositoryPrisma.documentDraft.update({
        where: { id: draft.id },
        data: {
          status: "pending_review",
        },
      });
      return {
        autoPosted: false,
        reason: eligibility.reason,
        anomalyFlags,
        postResult: null,
      };
    }

    const postResult = await postDraftFn(
      businessId,
      draft.id,
      systemUserId,
      { autoPosted: true },
    );

    return {
      autoPosted: true,
      reason: null,
      anomalyFlags,
      postResult,
    };
  }

  return {
    computeAnomalyFlags,
    evaluateAutoPostEligibility,
    attemptAutoPost,
    getEffectiveTrustThreshold,
  };
}

let defaultServicePromise: Promise<ReturnType<typeof createTrustService>> | null = null;

async function getDefaultService() {
  if (!defaultServicePromise) {
    defaultServicePromise = import("@/server/db/prisma").then(({ prisma }) =>
      createTrustService({
        prismaClient: prisma as unknown as TrustPrismaClient,
      }),
    );
  }
  return defaultServicePromise;
}

export async function computeAnomalyFlags(
  businessId: string,
  vendorProfileId: string,
  parsedFields: ParsedDraftFieldsForAnomaly,
) {
  const service = await getDefaultService();
  return service.computeAnomalyFlags(businessId, vendorProfileId, parsedFields);
}

export async function evaluateAutoPostEligibility(
  vendorProfile: VendorProfileRecord,
  draft: Pick<DocumentDraftRecord, "confidence_score" | "anomaly_flags">,
) {
  const service = await getDefaultService();
  return service.evaluateAutoPostEligibility(vendorProfile, draft);
}

export async function attemptAutoPost(businessId: string, draftId: string) {
  const service = await getDefaultService();
  return service.attemptAutoPost(businessId, draftId);
}
