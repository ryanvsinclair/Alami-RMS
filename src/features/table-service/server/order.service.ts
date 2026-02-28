import { serialize } from "@/domain/shared/serialize";
import { prisma } from "@/server/db/prisma";
import type {
  AppendKitchenOrderItemsInput,
  ConfirmKitchenOrderInput,
  KitchenOrderDraftItemInput,
  KitchenOrderItemStatusContract,
  TableServiceKitchenQueueEntry,
  TableServiceKitchenOrderSummary,
  UpdateKitchenOrderItemStatusInput,
} from "../shared/table-service.contracts";
import { KITCHEN_ORDER_ITEM_STATUSES } from "../shared/table-service.contracts";

type KitchenOrderRecord = {
  id: string;
  business_id: string;
  table_session_id: string;
  notes: string | null;
  confirmed_at: Date | null;
  due_at: Date | null;
  closed_at: Date | null;
  items: Array<{
    id: string;
    business_id: string;
    kitchen_order_id: string;
    menu_item_id: string;
    quantity: number;
    notes: string | null;
    status: KitchenOrderItemStatusContract;
  }>;
};

const CONFIRMATION_WINDOW_MS = 30 * 60 * 1000;
const KITCHEN_ORDER_ITEM_STATUS_SET = new Set<string>(KITCHEN_ORDER_ITEM_STATUSES);

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeConfirmItems(items: KitchenOrderDraftItemInput[]) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one order item is required to confirm");
  }

  return items.map((item, index) => {
    const menuItemId = item.menuItemId.trim();
    if (!menuItemId) {
      throw new Error(`Order item ${index + 1} is missing menu item id`);
    }

    const quantity = Math.trunc(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new Error(`Order item ${index + 1} has invalid quantity`);
    }

    return {
      menuItemId,
      quantity,
      notes: normalizeOptionalText(item.notes),
    };
  });
}

function toKitchenOrderSummary(order: KitchenOrderRecord): TableServiceKitchenOrderSummary {
  return {
    id: order.id,
    businessId: order.business_id,
    tableSessionId: order.table_session_id,
    notes: order.notes,
    confirmedAt: order.confirmed_at ? order.confirmed_at.toISOString() : null,
    dueAt: order.due_at ? order.due_at.toISOString() : null,
    closedAt: order.closed_at ? order.closed_at.toISOString() : null,
    items: order.items.map((item) => ({
      id: item.id,
      businessId: item.business_id,
      kitchenOrderId: item.kitchen_order_id,
      menuItemId: item.menu_item_id,
      quantity: item.quantity,
      notes: item.notes,
      status: item.status,
    })),
  };
}

function withDueAt(confirmedAt: Date) {
  return new Date(confirmedAt.getTime() + CONFIRMATION_WINDOW_MS);
}

export async function getKitchenOrderForSession(businessId: string, tableSessionId: string) {
  const order = await prisma.kitchenOrder.findFirst({
    where: {
      business_id: businessId,
      table_session_id: tableSessionId,
    },
    include: {
      items: {
        orderBy: [{ created_at: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!order) return null;
  return serialize(toKitchenOrderSummary(order as KitchenOrderRecord));
}

export async function getKitchenQueue(businessId: string) {
  const orders = await prisma.kitchenOrder.findMany({
    where: {
      business_id: businessId,
      closed_at: null,
      confirmed_at: {
        not: null,
      },
    },
    orderBy: [{ confirmed_at: "asc" }, { created_at: "asc" }],
    select: {
      id: true,
      business_id: true,
      table_session_id: true,
      notes: true,
      confirmed_at: true,
      due_at: true,
      table_session: {
        select: {
          dining_table_id: true,
          dining_table: {
            select: {
              table_number: true,
            },
          },
        },
      },
      items: {
        orderBy: [{ created_at: "asc" }, { id: "asc" }],
        select: {
          id: true,
          menu_item_id: true,
          quantity: true,
          notes: true,
          status: true,
          menu_item: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  const queue: TableServiceKitchenQueueEntry[] = orders
    .filter((order) => order.confirmed_at !== null)
    .map((order) => ({
      orderId: order.id,
      businessId: order.business_id,
      tableSessionId: order.table_session_id,
      tableId: order.table_session.dining_table_id,
      tableNumber: order.table_session.dining_table.table_number,
      orderNotes: order.notes,
      confirmedAt: (order.confirmed_at as Date).toISOString(),
      dueAt: order.due_at ? order.due_at.toISOString() : null,
      itemCount: order.items.length,
      items: order.items.map((item) => ({
        id: item.id,
        menuItemId: item.menu_item_id,
        menuItemName: item.menu_item.name,
        quantity: item.quantity,
        notes: item.notes,
        status: item.status,
      })),
    }));

  return serialize(queue);
}

export async function confirmKitchenOrder(
  businessId: string,
  input: ConfirmKitchenOrderInput,
) {
  const normalizedItems = normalizeConfirmItems(input.items);

  return prisma.$transaction(async (tx) => {
    const session = await tx.tableSession.findFirst({
      where: {
        id: input.tableSessionId,
        business_id: businessId,
        closed_at: null,
      },
      select: { id: true },
    });
    if (!session) {
      throw new Error("Active table session not found");
    }

    const existingOrder = await tx.kitchenOrder.findFirst({
      where: {
        business_id: businessId,
        table_session_id: session.id,
      },
      include: {
        items: {
          orderBy: [{ created_at: "asc" }, { id: "asc" }],
        },
      },
    });
    if (existingOrder) {
      if (existingOrder.confirmed_at && existingOrder.due_at) {
        return serialize(toKitchenOrderSummary(existingOrder as KitchenOrderRecord));
      }

      const confirmedAt = existingOrder.confirmed_at ?? new Date();
      const dueAt = existingOrder.due_at ?? withDueAt(confirmedAt);
      const backfilledOrder = await tx.kitchenOrder.update({
        where: { id: existingOrder.id },
        data: {
          confirmed_at: confirmedAt,
          due_at: dueAt,
        },
        include: {
          items: {
            orderBy: [{ created_at: "asc" }, { id: "asc" }],
          },
        },
      });
      return serialize(toKitchenOrderSummary(backfilledOrder as KitchenOrderRecord));
    }

    const uniqueMenuItemIds = Array.from(
      new Set(normalizedItems.map((item) => item.menuItemId)),
    );
    const availableMenuItems = await tx.menuItem.findMany({
      where: {
        id: { in: uniqueMenuItemIds },
        business_id: businessId,
        is_available: true,
      },
      select: { id: true },
    });
    if (availableMenuItems.length !== uniqueMenuItemIds.length) {
      throw new Error("One or more menu items are unavailable for confirmation");
    }

    const confirmedAt = new Date();
    const dueAt = withDueAt(confirmedAt);

    const createdOrder = await tx.kitchenOrder.create({
      data: {
        business_id: businessId,
        table_session_id: session.id,
        notes: normalizeOptionalText(input.notes),
        confirmed_at: confirmedAt,
        due_at: dueAt,
        items: {
          create: normalizedItems.map((item) => ({
            business_id: businessId,
            menu_item_id: item.menuItemId,
            quantity: item.quantity,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: {
          orderBy: [{ created_at: "asc" }, { id: "asc" }],
        },
      },
    });

    return serialize(toKitchenOrderSummary(createdOrder as KitchenOrderRecord));
  });
}

export async function appendKitchenOrderItems(
  businessId: string,
  input: AppendKitchenOrderItemsInput,
) {
  const kitchenOrderId = input.kitchenOrderId.trim();
  if (!kitchenOrderId) {
    throw new Error("Kitchen order id is required");
  }

  const normalizedItems = normalizeConfirmItems(input.items);

  return prisma.$transaction(async (tx) => {
    const existingOrder = await tx.kitchenOrder.findFirst({
      where: {
        id: kitchenOrderId,
        business_id: businessId,
        closed_at: null,
        table_session: {
          closed_at: null,
        },
      },
      include: {
        items: {
          orderBy: [{ created_at: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!existingOrder) {
      throw new Error("Active kitchen ticket not found");
    }

    const uniqueMenuItemIds = Array.from(
      new Set(normalizedItems.map((item) => item.menuItemId)),
    );
    const availableMenuItems = await tx.menuItem.findMany({
      where: {
        id: { in: uniqueMenuItemIds },
        business_id: businessId,
        is_available: true,
      },
      select: { id: true },
    });
    if (availableMenuItems.length !== uniqueMenuItemIds.length) {
      throw new Error("One or more menu items are unavailable for append");
    }

    await tx.kitchenOrderItem.createMany({
      data: normalizedItems.map((item) => ({
        business_id: businessId,
        kitchen_order_id: existingOrder.id,
        menu_item_id: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes,
      })),
    });

    const updatedOrder = await tx.kitchenOrder.findUnique({
      where: { id: existingOrder.id },
      include: {
        items: {
          orderBy: [{ created_at: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!updatedOrder) {
      throw new Error("Kitchen ticket disappeared after append");
    }

    return serialize(toKitchenOrderSummary(updatedOrder as KitchenOrderRecord));
  });
}

export async function updateKitchenOrderItemStatus(
  businessId: string,
  input: UpdateKitchenOrderItemStatusInput,
) {
  const kitchenOrderItemId = input.kitchenOrderItemId.trim();
  if (!kitchenOrderItemId) {
    throw new Error("Kitchen order item id is required");
  }
  if (!KITCHEN_ORDER_ITEM_STATUS_SET.has(input.status)) {
    throw new Error("Invalid kitchen order item status");
  }

  const existingItem = await prisma.kitchenOrderItem.findFirst({
    where: {
      id: kitchenOrderItemId,
      business_id: businessId,
      kitchen_order: {
        closed_at: null,
        table_session: {
          closed_at: null,
        },
      },
    },
    select: { id: true },
  });
  if (!existingItem) {
    throw new Error("Kitchen order item not found");
  }

  const updatedItem = await prisma.kitchenOrderItem.update({
    where: { id: existingItem.id },
    data: {
      status: input.status,
    },
    select: {
      id: true,
      status: true,
    },
  });

  return serialize({
    id: updatedItem.id,
    status: updatedItem.status as KitchenOrderItemStatusContract,
  });
}
