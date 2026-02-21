import { prisma } from "@/lib/prisma";
import { similarity, normalizeText, wordOverlap } from "./fuzzy";
import { scoreToConfidence } from "./confidence";
import type { MatchConfidence } from "@/lib/generated/prisma/client";

// ============================================================
// Match result type
// ============================================================

export interface MatchResult {
  inventory_item_id: string;
  item_name: string;
  score: number;
  confidence: MatchConfidence;
  match_source: "exact_alias" | "fuzzy_alias" | "fuzzy_name" | "word_overlap";
}

// ============================================================
// Core matching engine
// ============================================================

/**
 * Match a raw text string (e.g., from receipt OCR) against
 * the inventory master using aliases and fuzzy matching.
 *
 * Returns top matches sorted by score, or empty array if nothing found.
 */
export async function matchText(
  rawText: string,
  limit = 5
): Promise<MatchResult[]> {
  const normalized = normalizeText(rawText);
  if (!normalized) return [];

  // Phase 1: Exact alias match (fastest, highest confidence)
  const exactAlias = await prisma.itemAlias.findFirst({
    where: {
      alias_text: { equals: normalized, mode: "insensitive" },
    },
    include: { inventory_item: true },
  });

  if (exactAlias) {
    return [
      {
        inventory_item_id: exactAlias.inventory_item_id,
        item_name: exactAlias.inventory_item.name,
        score: 1.0,
        confidence: "high",
        match_source: "exact_alias",
      },
    ];
  }

  // Phase 2: Load all aliases + items for fuzzy comparison
  // In production with large catalogs, use pg_trgm index via raw SQL.
  // For MVP scale (<1000 items), in-memory is fine.
  const [aliases, items] = await Promise.all([
    prisma.itemAlias.findMany({
      include: { inventory_item: { select: { id: true, name: true } } },
    }),
    prisma.inventoryItem.findMany({
      where: { is_active: true },
      select: { id: true, name: true },
    }),
  ]);

  const candidates: MatchResult[] = [];

  // Phase 2a: Fuzzy alias matching
  for (const alias of aliases) {
    const sim = similarity(normalized, alias.alias_text);
    if (sim >= 0.2) {
      candidates.push({
        inventory_item_id: alias.inventory_item.id,
        item_name: alias.inventory_item.name,
        score: sim,
        confidence: scoreToConfidence(sim),
        match_source: "fuzzy_alias",
      });
    }
  }

  // Phase 2b: Fuzzy name matching
  for (const item of items) {
    const sim = similarity(normalized, item.name);
    if (sim >= 0.2) {
      candidates.push({
        inventory_item_id: item.id,
        item_name: item.name,
        score: sim,
        confidence: scoreToConfidence(sim),
        match_source: "fuzzy_name",
      });
    }
  }

  // Phase 2c: Word overlap (catches abbreviated text like "CHK BRST")
  for (const item of items) {
    const overlap = wordOverlap(normalized, item.name);
    if (overlap >= 0.3) {
      candidates.push({
        inventory_item_id: item.id,
        item_name: item.name,
        score: overlap * 0.9, // slightly penalize vs direct similarity
        confidence: scoreToConfidence(overlap * 0.9),
        match_source: "word_overlap",
      });
    }
  }

  // Deduplicate by item id, keeping highest score
  const bestByItem = new Map<string, MatchResult>();
  for (const c of candidates) {
    const existing = bestByItem.get(c.inventory_item_id);
    if (!existing || c.score > existing.score) {
      bestByItem.set(c.inventory_item_id, c);
    }
  }

  return Array.from(bestByItem.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Learn a new alias from a user correction.
 * Called when user confirms a match that wasn't auto-matched.
 */
export async function learnAlias(
  inventoryItemId: string,
  rawText: string,
  source: "barcode" | "photo" | "manual" | "receipt"
) {
  const normalized = normalizeText(rawText);
  if (!normalized) return;

  // Upsert to avoid duplicates
  await prisma.itemAlias.upsert({
    where: {
      inventory_item_id_alias_text: {
        inventory_item_id: inventoryItemId,
        alias_text: normalized,
      },
    },
    create: {
      inventory_item_id: inventoryItemId,
      alias_text: normalized,
      source,
    },
    update: {}, // already exists, no-op
  });
}
