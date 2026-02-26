/**
 * Shopping order history and reorder services.
 */

import { prisma } from "@/core/prisma";
import { serialize } from "@/core/utils/serialize";
import { toNumber, round } from "./helpers";
import { recomputeSessionState } from "./session-state.service";
import { findSessionById } from "./session.repository";

export async function getCommittedShoppingSessions(
  businessId: string,
  limit = 30
) {
  const sessions = await prisma.shoppingSession.findMany({
    where: { business_id: businessId, status: "committed" },
    orderBy: { completed_at: "desc" },
    take: limit,
    include: {
      supplier: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
  return serialize(sessions);
}

export async function getItemPriceHistory(
  inventoryItemId: string,
  businessId: string,
  limit = 20
) {
  const rows = await prisma.itemPriceHistory.findMany({
    where: { inventory_item_id: inventoryItemId, business_id: businessId },
    orderBy: { recorded_at: "desc" },
    take: limit,
    include: { supplier: { select: { name: true } } },
  });
  return serialize(rows);
}

export async function reorderShoppingSession(
  pastSessionId: string,
  businessId: string
) {
  const past = await prisma.shoppingSession.findFirstOrThrow({
    where: { id: pastSessionId, business_id: businessId },
    include: {
      supplier: true,
      items: {
        where: { origin: "staged", resolution: { not: "skip" } },
        include: { inventory_item: true },
      },
    },
  });

  if (!past.supplier || !past.google_place_id) {
    throw new Error("Session has no store information");
  }

  const newSession = await prisma.shoppingSession.create({
    data: {
      business_id: businessId,
      supplier_id: past.supplier_id,
      google_place_id: past.google_place_id,
      store_name: past.store_name,
      store_address: past.store_address,
      store_lat: past.store_lat,
      store_lng: past.store_lng,
      status: "draft",
    },
  });

  for (const item of past.items) {
    const price = item.inventory_item?.default_cost
      ? toNumber(item.inventory_item.default_cost)
      : toNumber(item.staged_unit_price);
    const qty = toNumber(item.quantity) ?? 1;

    await prisma.shoppingSessionItem.create({
      data: {
        session_id: newSession.id,
        inventory_item_id: item.inventory_item_id,
        raw_name: item.raw_name,
        normalized_name: item.normalized_name,
        quantity: qty,
        unit: item.unit,
        staged_unit_price: price,
        staged_line_total: price != null ? round(qty * price) : null,
        origin: "staged",
        reconciliation_status: "pending",
        resolution: "pending",
      },
    });
  }

  await prisma.$transaction(async (tx) => {
    await recomputeSessionState(tx, newSession.id);
  });

  return findSessionById(newSession.id, businessId);
}
