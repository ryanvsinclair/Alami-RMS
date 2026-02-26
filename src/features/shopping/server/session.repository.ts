/**
 * Shopping session Prisma repository.
 * Encapsulates all shopping session queries and standard includes.
 */

import { prisma } from "@/server/db/prisma";
import { serialize } from "@/core/utils/serialize";
import { OPEN_STATUSES } from "./contracts";
import type { Prisma } from "@/lib/generated/prisma/client";

// ─── Standard includes ──────────────────────────────────────

const SESSION_WITH_ITEMS_INCLUDE = {
  supplier: true,
  items: {
    orderBy: { created_at: "asc" } as const,
    include: { inventory_item: true, receipt_line: true },
  },
  receipt: true,
} satisfies Prisma.ShoppingSessionInclude;

const SESSION_WITH_RECEIPT_LINES_INCLUDE = {
  supplier: true,
  items: {
    orderBy: { created_at: "asc" } as const,
    include: { inventory_item: true, receipt_line: true },
  },
  receipt: {
    include: {
      line_items: {
        orderBy: { line_number: "asc" } as const,
        include: { matched_item: true },
      },
    },
  },
} satisfies Prisma.ShoppingSessionInclude;

// ─── Queries ─────────────────────────────────────────────────

export async function findActiveSession(businessId: string) {
  const sessions = await prisma.shoppingSession.findMany({
    where: { business_id: businessId, status: { in: OPEN_STATUSES } },
    orderBy: { started_at: "desc" },
    take: 1,
    include: SESSION_WITH_ITEMS_INCLUDE,
  });
  return sessions[0] ? serialize(sessions[0]) : null;
}

export async function findSessionById(sessionId: string, businessId: string) {
  const session = await prisma.shoppingSession.findFirst({
    where: { id: sessionId, business_id: businessId },
    include: SESSION_WITH_RECEIPT_LINES_INCLUDE,
  });
  return session ? serialize(session) : null;
}

export async function findSessionWithItems(
  tx: Prisma.TransactionClient,
  sessionId: string,
  businessId: string
) {
  return tx.shoppingSession.findFirstOrThrow({
    where: { id: sessionId, business_id: businessId },
    include: {
      items: { orderBy: { created_at: "asc" } },
    },
  });
}

export async function findSessionWithItemsAndSupplier(
  tx: Prisma.TransactionClient,
  sessionId: string,
  businessId: string
) {
  return tx.shoppingSession.findFirstOrThrow({
    where: { id: sessionId, business_id: businessId },
    include: {
      supplier: true,
      items: { orderBy: { created_at: "asc" } },
    },
  });
}

export async function findFullSession(
  tx: Prisma.TransactionClient,
  sessionId: string
) {
  const result = await tx.shoppingSession.findUnique({
    where: { id: sessionId },
    include: SESSION_WITH_RECEIPT_LINES_INCLUDE,
  });
  return result ? serialize(result) : null;
}
