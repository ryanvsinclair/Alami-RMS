import { prisma } from "@/core/prisma";
import type {
  LineItemStatus,
  MatchConfidence,
} from "@/lib/generated/prisma/client";
import { matchText, type MatchResult } from "./engine";
import {
  buildReceiptItemAliasLookupWhere,
  buildReceiptItemAliasUpsertArgs,
  extractReceiptStoreLineCode,
  normalizeReceiptAliasText,
  resolveReceiptLineMatchCore,
  type ReceiptLineMatchProfile as CoreReceiptLineMatchProfile,
} from "./receipt-line-core";

export type ReceiptLineMatchProfile = CoreReceiptLineMatchProfile;

export interface ResolveReceiptLineMatchInput {
  rawText: string;
  parsedName?: string | null;
  businessId: string;
  googlePlaceId?: string | null;
  profile: ReceiptLineMatchProfile;
}

export interface ResolvedReceiptLineMatch {
  matched_item_id: string | null;
  confidence: MatchConfidence;
  status: LineItemStatus;
  topMatch: MatchResult | null;
}

type ReceiptItemAliasLookupRow = {
  inventory_item_id: string;
  inventory_item: {
    id: string;
    name: string;
  };
};

type ReceiptItemAliasDelegate = {
  findFirst(args: {
    where: Record<string, unknown>;
    select: Record<string, unknown>;
  }): Promise<ReceiptItemAliasLookupRow | null>;
  upsert(args: {
    where: Record<string, unknown>;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<unknown>;
};

function getReceiptItemAliasDelegate(): ReceiptItemAliasDelegate | null {
  const client = prisma as unknown as Partial<{
    receiptItemAlias: ReceiptItemAliasDelegate;
  }>;
  const delegate = client.receiptItemAlias;

  if (
    !delegate ||
    typeof delegate.findFirst !== "function" ||
    typeof delegate.upsert !== "function"
  ) {
    return null;
  }

  return delegate;
}

async function findReceiptPlaceAliasMatch(params: {
  businessId: string;
  googlePlaceId?: string | null;
  searchText: string;
}): Promise<MatchResult | null> {
  const where = buildReceiptItemAliasLookupWhere({
    businessId: params.businessId,
    googlePlaceId: params.googlePlaceId,
    searchText: params.searchText,
  });
  if (!where) return null;

  const delegate = getReceiptItemAliasDelegate();
  if (!delegate) return null;

  try {
    const alias = await delegate.findFirst({
      where,
      select: {
        inventory_item_id: true,
        inventory_item: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!alias) return null;

    return {
      inventory_item_id: alias.inventory_item_id,
      item_name: alias.inventory_item.name,
      score: 1,
      confidence: "high",
      match_source: "receipt_place_alias",
    };
  } catch {
    return null;
  }
}

async function findReceiptPlaceCodeAliasMatch(params: {
  businessId: string;
  googlePlaceId?: string | null;
  lineCode: string;
}): Promise<MatchResult | null> {
  const match = await findReceiptPlaceAliasMatch({
    businessId: params.businessId,
    googlePlaceId: params.googlePlaceId,
    searchText: params.lineCode,
  });

  if (!match) return null;

  return {
    ...match,
    match_source: "receipt_place_code_alias",
  };
}

export async function learnReceiptItemAlias(params: {
  businessId: string;
  googlePlaceId?: string | null;
  inventoryItemId: string;
  rawText: string;
  confidence?: MatchConfidence;
}): Promise<void> {
  if (!params.googlePlaceId) return;

  const normalized = normalizeReceiptAliasText(params.rawText);
  if (!normalized) return;

  const item = await prisma.inventoryItem.findFirst({
    where: {
      id: params.inventoryItemId,
      business_id: params.businessId,
    },
    select: { id: true },
  });
  if (!item) return;

  const delegate = getReceiptItemAliasDelegate();
  if (!delegate) return;

  const upsertArgs = buildReceiptItemAliasUpsertArgs({
    businessId: params.businessId,
    googlePlaceId: params.googlePlaceId,
    inventoryItemId: params.inventoryItemId,
    rawText: params.rawText,
    confidence: params.confidence,
  });
  if (!upsertArgs) return;

  const aliasesToSave = [upsertArgs];
  const lineCode = extractReceiptStoreLineCode(params.rawText);
  if (lineCode && lineCode !== normalized) {
    const codeUpsertArgs = buildReceiptItemAliasUpsertArgs({
      businessId: params.businessId,
      googlePlaceId: params.googlePlaceId,
      inventoryItemId: params.inventoryItemId,
      rawText: lineCode,
      confidence: params.confidence,
    });
    if (codeUpsertArgs) {
      aliasesToSave.push(codeUpsertArgs);
    }
  }

  try {
    for (const args of aliasesToSave) {
      await delegate.upsert(args);
    }
  } catch {
    // Fail open until the Prisma client/migration for ReceiptItemAlias is applied.
  }
}

export async function resolveReceiptLineMatch({
  rawText,
  parsedName,
  businessId,
  googlePlaceId,
  profile,
}: ResolveReceiptLineMatchInput): Promise<ResolvedReceiptLineMatch> {
  const resolved = await resolveReceiptLineMatchCore({
    rawText,
    parsedName,
    profile,
    findPlaceCodeAliasMatch: async (lineCode) =>
      findReceiptPlaceCodeAliasMatch({
        businessId,
        googlePlaceId,
        lineCode,
      }),
    findPlaceAliasMatch: async (searchText) =>
      findReceiptPlaceAliasMatch({
        businessId,
        googlePlaceId,
        searchText,
      }),
    matchTextCandidates: async (searchText) => matchText(searchText, 1, businessId),
  });

  return {
    matched_item_id: resolved.matched_item_id,
    confidence: resolved.confidence as MatchConfidence,
    status: resolved.status as LineItemStatus,
    topMatch: resolved.topMatch as MatchResult | null,
  };
}
