"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  appendKitchenOrderItems,
  closeKitchenOrderAndSession,
  confirmKitchenOrder,
  requestKitchenOrderItemChange,
  updateKitchenOrderItemStatus,
} from "@/app/actions/modules/table-service";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import type {
  KitchenOrderItemStatusContract,
  TableServiceKitchenOrderSummary,
  TableServiceMenuCategorySummary,
  TableServiceMenuItemSummary,
  TableServiceSessionSummary,
} from "@/features/table-service/shared";

type DraftLineItem = {
  id: string;
  menuItemId: string;
  quantity: string;
  notes: string;
};

type CategoryFilterId = "all" | "uncategorized" | string;

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const STATUS_LABEL_BY_ID: Record<KitchenOrderItemStatusContract, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready_to_serve: "Ready",
  served: "Served",
  cancelled: "Cancelled",
};

const STATUS_PILL_CLASS_BY_ID: Record<KitchenOrderItemStatusContract, string> = {
  pending: "border-border bg-foreground/[0.03] text-muted",
  preparing: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  ready_to_serve: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  served: "border-primary/40 bg-primary/15 text-primary",
  cancelled: "border-danger/30 bg-danger/10 text-danger",
};

const HOST_EDITABLE_SENT_ITEM_STATUS_SET = new Set<KitchenOrderItemStatusContract>([
  "pending",
  "preparing",
]);

function toPriceNumber(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function toQuantity(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function makeDraftId() {
  return `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

interface HostOrderComposerPageClientProps {
  session: TableServiceSessionSummary;
  kitchenOrder: TableServiceKitchenOrderSummary | null;
  categories: TableServiceMenuCategorySummary[];
  items: TableServiceMenuItemSummary[];
}

export default function HostOrderComposerPageClient({
  session,
  kitchenOrder,
  categories,
  items,
}: HostOrderComposerPageClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<CategoryFilterId>("all");
  const [draftItems, setDraftItems] = useState<DraftLineItem[]>([]);
  const [orderNotes, setOrderNotes] = useState(kitchenOrder?.notes ?? "");
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const [editingSentItemId, setEditingSentItemId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState<TableServiceKitchenOrderSummary | null>(
    kitchenOrder,
  );

  const categoryById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category.name]));
  }, [categories]);

  const categorySortOrderById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category.sortOrder]));
  }, [categories]);

  const itemsById = useMemo(() => {
    return new Map(items.map((item) => [item.id, item]));
  }, [items]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aCategorySort = a.categoryId
        ? (categorySortOrderById.get(a.categoryId) ?? 0)
        : Number.MAX_SAFE_INTEGER;
      const bCategorySort = b.categoryId
        ? (categorySortOrderById.get(b.categoryId) ?? 0)
        : Number.MAX_SAFE_INTEGER;
      if (aCategorySort !== bCategorySort) return aCategorySort - bCategorySort;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name);
    });
  }, [categorySortOrderById, items]);

  const categoryFilters = useMemo(() => {
    const countsByCategory = new Map<string, number>();
    let uncategorizedCount = 0;

    for (const item of items) {
      if (item.categoryId) {
        countsByCategory.set(item.categoryId, (countsByCategory.get(item.categoryId) ?? 0) + 1);
      } else {
        uncategorizedCount += 1;
      }
    }

    const base = [{ id: "all", label: "All", count: items.length }];
    const categoryChips = categories
      .map((category) => ({
        id: category.id,
        label: category.name,
        count: countsByCategory.get(category.id) ?? 0,
      }))
      .filter((entry) => entry.count > 0);

    if (uncategorizedCount > 0) {
      categoryChips.push({ id: "uncategorized", label: "No Category", count: uncategorizedCount });
    }

    return [...base, ...categoryChips];
  }, [categories, items]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = normalizeSearchText(searchTerm);

    return sortedItems.filter((item) => {
      if (activeCategoryFilter === "uncategorized" && item.categoryId !== null) {
        return false;
      }
      if (
        activeCategoryFilter !== "all" &&
        activeCategoryFilter !== "uncategorized" &&
        item.categoryId !== activeCategoryFilter
      ) {
        return false;
      }

      if (!normalizedSearch) return true;

      const categoryName = item.categoryId ? (categoryById.get(item.categoryId) ?? "") : "";
      const haystack = [item.name, item.description ?? "", categoryName]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [activeCategoryFilter, categoryById, searchTerm, sortedItems]);

  const draftQuantityByMenuItemId = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of draftItems) {
      map.set(line.menuItemId, (map.get(line.menuItemId) ?? 0) + toQuantity(line.quantity));
    }
    return map;
  }, [draftItems]);

  const draftSummary = useMemo(() => {
    return draftItems.reduce(
      (acc, line) => {
        const menuItem = itemsById.get(line.menuItemId);
        if (!menuItem) return acc;

        const quantity = toQuantity(line.quantity);
        acc.lineCount += 1;
        acc.totalQuantity += quantity;
        acc.subtotal += quantity * toPriceNumber(menuItem.price);
        return acc;
      },
      { lineCount: 0, totalQuantity: 0, subtotal: 0 },
    );
  }, [draftItems, itemsById]);

  const hasConfirmedOrder = confirmedOrder !== null;
  const isOrderClosed = Boolean(confirmedOrder?.closedAt);
  const existingOrderLineCount = confirmedOrder?.items.length ?? 0;
  const currentCheckLineCount = existingOrderLineCount + draftItems.length;

  function isSentItemEditable(status: KitchenOrderItemStatusContract) {
    if (isOrderClosed) return false;
    return HOST_EDITABLE_SENT_ITEM_STATUS_SET.has(status);
  }

  function patchConfirmedOrderItem(
    kitchenOrderItemId: string,
    patch: Partial<TableServiceKitchenOrderSummary["items"][number]>,
  ) {
    setConfirmedOrder((previous) => {
      if (!previous) return previous;

      return {
        ...previous,
        items: previous.items.map((item) => {
          if (item.id !== kitchenOrderItemId) return item;
          return {
            ...item,
            ...patch,
          };
        }),
      };
    });
  }

  async function handleUpdateExistingItemQuantity(
    item: TableServiceKitchenOrderSummary["items"][number],
    nextQuantity: number,
  ) {
    if (!isSentItemEditable(item.status)) return;

    const normalizedQuantity = Math.max(1, Math.trunc(nextQuantity));

    setError("");
    setSuccess("");
    setEditingSentItemId(item.id);

    try {
      const updatedItem = (await requestKitchenOrderItemChange({
        kitchenOrderItemId: item.id,
        quantity: normalizedQuantity,
      })) as TableServiceKitchenOrderSummary["items"][number];

      patchConfirmedOrderItem(item.id, {
        quantity: updatedItem.quantity,
        notes: updatedItem.notes,
        status: updatedItem.status,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to update item quantity.",
      );
    } finally {
      setEditingSentItemId(null);
    }
  }

  async function handleAddNoteToExistingItem(item: TableServiceKitchenOrderSummary["items"][number]) {
    if (!isSentItemEditable(item.status)) return;

    const notePrompt = window.prompt(
      "Add or edit note for this item. Leave blank to clear.",
      item.notes ?? "",
    );
    if (notePrompt === null) return;

    setError("");
    setSuccess("");
    setEditingSentItemId(item.id);

    try {
      const updatedItem = (await requestKitchenOrderItemChange({
        kitchenOrderItemId: item.id,
        notes: notePrompt,
      })) as TableServiceKitchenOrderSummary["items"][number];

      patchConfirmedOrderItem(item.id, {
        quantity: updatedItem.quantity,
        notes: updatedItem.notes,
        status: updatedItem.status,
      });
      setSuccess("Item note updated.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to update item note.",
      );
    } finally {
      setEditingSentItemId(null);
    }
  }

  async function handleRequestRemove(item: TableServiceKitchenOrderSummary["items"][number]) {
    if (!isSentItemEditable(item.status)) return;

    const confirmed = window.confirm(
      "Request removing this item from the ticket? This marks the line as cancelled.",
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setEditingSentItemId(item.id);

    try {
      await updateKitchenOrderItemStatus({
        kitchenOrderItemId: item.id,
        status: "cancelled",
        bumpQueuePosition: true,
      });
      patchConfirmedOrderItem(item.id, {
        status: "cancelled",
      });
      setSuccess("Removal requested. Item marked as cancelled.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to request item removal.",
      );
    } finally {
      setEditingSentItemId(null);
    }
  }

  function handleAddMenuItem(menuItemId: string) {
    setError("");
    setSuccess("");

    if (isOrderClosed) {
      setError("Order is already closed.");
      return;
    }

    const menuItem = itemsById.get(menuItemId);
    if (!menuItem) {
      setError("Selected menu item is unavailable.");
      return;
    }

    setDraftItems((previous) => {
      const existingIndex = previous.findIndex(
        (line) => line.menuItemId === menuItemId && !line.notes.trim(),
      );
      if (existingIndex < 0) {
        return [
          ...previous,
          {
            id: makeDraftId(),
            menuItemId,
            quantity: "1",
            notes: "",
          },
        ];
      }

      return previous.map((line, index) => {
        if (index !== existingIndex) return line;
        const nextQuantity = toQuantity(line.quantity) + 1;
        return {
          ...line,
          quantity: String(nextQuantity),
        };
      });
    });
  }

  function updateLineQuantity(lineId: string, nextQuantity: number) {
    setDraftItems((previous) =>
      previous.map((line) => {
        if (line.id !== lineId) return line;
        return {
          ...line,
          quantity: String(Math.max(1, Math.trunc(nextQuantity))),
        };
      }),
    );
  }

  function updateLineNotes(lineId: string, nextNotes: string) {
    setDraftItems((previous) =>
      previous.map((line) => {
        if (line.id !== lineId) return line;
        return {
          ...line,
          notes: nextNotes,
        };
      }),
    );
  }

  function handleAddNoteToDraftLine(lineId: string) {
    const currentLine = draftItems.find((line) => line.id === lineId);
    if (!currentLine) return;

    const notePrompt = window.prompt(
      "Add or edit note for this item. Leave blank to clear.",
      currentLine.notes ?? "",
    );
    if (notePrompt === null) return;
    updateLineNotes(lineId, notePrompt);
  }

  function removeLine(lineId: string) {
    setDraftItems((previous) => previous.filter((line) => line.id !== lineId));
  }

  async function handleSubmitOrder() {
    setError("");
    setSuccess("");

    if (isOrderClosed) {
      setError("Order is closed and cannot be edited.");
      return;
    }

    if (draftItems.length === 0) {
      setError("Add at least one item before sending to kitchen.");
      return;
    }

    const payloadItems = draftItems.map((line) => ({
      menuItemId: line.menuItemId,
      quantity: toQuantity(line.quantity),
      notes: line.notes.trim() ? line.notes.trim() : null,
    }));

    const activeConfirmedOrder = confirmedOrder;

    setConfirming(true);
    try {
      const nextOrder = hasConfirmedOrder && activeConfirmedOrder
        ? ((await appendKitchenOrderItems({
            kitchenOrderId: activeConfirmedOrder.id,
            items: payloadItems,
          })) as TableServiceKitchenOrderSummary)
        : ((await confirmKitchenOrder({
            tableSessionId: session.id,
            notes: orderNotes.trim() ? orderNotes.trim() : null,
            items: payloadItems,
          })) as TableServiceKitchenOrderSummary);

      setConfirmedOrder(nextOrder);
      setDraftItems([]);
      setSuccess(
        hasConfirmedOrder
          ? "Items sent and appended to the active kitchen ticket."
          : "Kitchen ticket created and sent.",
      );
    } catch {
      setError(
        hasConfirmedOrder
          ? "Failed to send additional items to kitchen ticket."
          : "Failed to send order to kitchen.",
      );
    } finally {
      setConfirming(false);
    }
  }

  async function handleDonePaid() {
    if (!confirmedOrder || isOrderClosed) return;

    setError("");
    setSuccess("");
    setClosing(true);

    try {
      const closedOrder = (await closeKitchenOrderAndSession({
        kitchenOrderId: confirmedOrder.id,
      })) as TableServiceKitchenOrderSummary;
      setConfirmedOrder(closedOrder);
      setDraftItems([]);
      setSuccess("Order and table session were closed with done/paid.");
    } catch {
      setError("Failed to close order and table session.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="space-y-4">
        {success && (
          <div className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
            {success}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-4">
          <div className="sticky top-4 z-10 space-y-3 bg-transparent pb-2">
            <div className="design-glass-surface rounded-xl px-3 py-2">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search menu items"
                className="h-10 w-full border-0 bg-transparent text-sm text-foreground placeholder:text-muted/75 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {categoryFilters.map((filter) => {
                const isActive = activeCategoryFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveCategoryFilter(filter.id)}
                    className={`design-glass-chip shrink-0 px-3 py-2 text-xs font-medium ${
                      isActive ? "design-glass-chip-active" : ""
                    }`}
                  >
                    {filter.label} ({filter.count})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:pr-1">
            {items.length === 0 ? (
              <div className="design-glass-surface rounded-xl border-dashed px-4 py-5 text-sm text-muted">
                No available menu items yet. Add menu items in{" "}
                <Link href="/service/menu" className="text-primary hover:underline">
                  Menu Setup
                </Link>
                .
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="design-glass-surface rounded-xl border-dashed px-4 py-5 text-sm text-muted">
                No menu items match your current filter.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                {filteredItems.map((item) => {
                  const categoryName = item.categoryId
                    ? (categoryById.get(item.categoryId) ?? "No category")
                    : "No category";
                  const pendingQuantity = draftQuantityByMenuItemId.get(item.id) ?? 0;

                  return (
                    <div key={item.id} className="design-glass-surface p-3">
                      <div className="relative">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-28 w-full rounded-lg border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-28 w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted">
                            No Image
                          </div>
                        )}
                        {pendingQuantity > 0 && (
                          <span className="absolute right-2 top-2 rounded-full border border-primary/45 bg-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            +{pendingQuantity}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 space-y-1">
                        <p className="text-sm font-semibold text-foreground">{item.name}</p>
                        <p className="text-xs text-muted">{categoryName}</p>
                        {item.description && (
                          <p className="line-clamp-2 text-xs text-muted">{item.description}</p>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {moneyFormatter.format(toPriceNumber(item.price))}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => handleAddMenuItem(item.id)}
                          disabled={isOrderClosed}
                        >
                          {isOrderClosed ? "Closed" : "Add"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </section>

          <aside className="space-y-4">
            <div className="design-glass-surface p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Current Check</p>
              <p className="text-xs text-muted">{currentCheckLineCount} line(s)</p>
            </div>

            {currentCheckLineCount === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted">
                Add items from the menu grid to build this check.
              </div>
            ) : (
              <div className="space-y-2">
                {existingOrderLineCount > 0 && (
                  <p className="px-1 text-xs font-semibold text-muted">Existing Ticket Items</p>
                )}
                {existingOrderLineCount > 0 && confirmedOrder?.items.map((item) => {
                      const menuItem = itemsById.get(item.menuItemId);
                      const itemName = menuItem?.name ?? `Item ${item.menuItemId}`;
                      const categoryName = menuItem?.categoryId
                        ? (categoryById.get(menuItem.categoryId) ?? "No category")
                        : "No category";
                      const unitPrice = toPriceNumber(menuItem?.price ?? 0);
                      const lineTotal = item.quantity * unitPrice;
                      const canRequestEdits = isSentItemEditable(item.status);
                      const isMutating = editingSentItemId === item.id;

                      return (
                        <div key={item.id} className="rounded-xl border border-border bg-foreground/[0.02] p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {itemName}
                              </p>
                              <p className="text-xs text-muted">
                                {categoryName} | {moneyFormatter.format(unitPrice)} each
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                {moneyFormatter.format(lineTotal)}
                              </p>
                              <span
                                className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL_CLASS_BY_ID[item.status]}`}
                              >
                                {STATUS_LABEL_BY_ID[item.status]}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleUpdateExistingItemQuantity(item, item.quantity - 1)}
                              disabled={!canRequestEdits || isMutating || item.quantity <= 1}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground disabled:opacity-40"
                              aria-label={`Decrease ${itemName} quantity`}
                            >
                              -
                            </button>
                            <span className="min-w-7 text-center text-sm font-semibold text-foreground">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleUpdateExistingItemQuantity(item, item.quantity + 1)}
                              disabled={!canRequestEdits || isMutating}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground disabled:opacity-40"
                              aria-label={`Increase ${itemName} quantity`}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAddNoteToExistingItem(item)}
                              disabled={!canRequestEdits || isMutating}
                              className="ml-auto rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-foreground disabled:opacity-40"
                            >
                              Add Note
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRequestRemove(item)}
                              disabled={!canRequestEdits || isMutating}
                              className="rounded-lg border border-danger/40 px-2 py-1 text-[11px] font-semibold text-danger disabled:opacity-40"
                            >
                              Remove Item
                            </button>
                          </div>

                          {item.notes && (
                            <p className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-muted">
                              Note: {item.notes}
                            </p>
                          )}

                          {!canRequestEdits && (
                            <p className="text-[11px] text-muted">
                              Changes are locked once item is ready, served, or cancelled.
                            </p>
                          )}
                        </div>
                      );
                    })}

                {draftItems.length > 0 && (
                  <p className="px-1 text-xs font-semibold text-muted">New Draft Adds</p>
                )}
                {draftItems.map((line) => {
                  const menuItem = itemsById.get(line.menuItemId);
                  if (!menuItem) return null;

                  const quantity = toQuantity(line.quantity);
                  const unitPrice = toPriceNumber(menuItem.price);
                  const lineTotal = quantity * unitPrice;
                  const categoryName = menuItem.categoryId
                    ? (categoryById.get(menuItem.categoryId) ?? "No category")
                    : "No category";

                  return (
                    <div key={line.id} className="rounded-xl border border-border bg-foreground/[0.02] p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{menuItem.name}</p>
                          <p className="text-xs text-muted">
                            {categoryName} | {moneyFormatter.format(unitPrice)} each
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {moneyFormatter.format(lineTotal)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateLineQuantity(line.id, quantity - 1)}
                          disabled={isOrderClosed || quantity <= 1}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground disabled:opacity-40"
                          aria-label={`Decrease ${menuItem.name} quantity`}
                        >
                          -
                        </button>
                        <span className="min-w-7 text-center text-sm font-semibold text-foreground">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateLineQuantity(line.id, quantity + 1)}
                          disabled={isOrderClosed}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground disabled:opacity-40"
                          aria-label={`Increase ${menuItem.name} quantity`}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddNoteToDraftLine(line.id)}
                          disabled={isOrderClosed}
                          className="ml-auto rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-foreground disabled:opacity-40"
                        >
                          Add Note
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          disabled={isOrderClosed}
                          className="rounded-lg border border-danger/40 px-2 py-1 text-[11px] font-semibold text-danger disabled:opacity-40"
                        >
                          Remove Item
                        </button>
                      </div>

                      {line.notes.trim() && (
                        <p className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-muted">
                          Note: {line.notes.trim()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            </div>

            <div className="design-glass-surface p-4 space-y-3">
            <p className="text-sm font-semibold">Check Actions</p>
            <div className="rounded-xl border border-border bg-foreground/[0.03] px-3 py-2 text-sm text-muted space-y-1">
              <p>Draft lines: {draftSummary.lineCount}</p>
              <p>Total quantity: {draftSummary.totalQuantity}</p>
              <p className="font-semibold text-foreground">
                Draft subtotal: {moneyFormatter.format(draftSummary.subtotal)}
              </p>
            </div>

            <Input
              label="Order notes"
              placeholder="Allergy note or pacing instruction"
              value={orderNotes}
              disabled={hasConfirmedOrder}
              onChange={(event) => setOrderNotes(event.target.value)}
            />

            <Button
              className="w-full"
              onClick={handleSubmitOrder}
              loading={confirming}
              disabled={draftItems.length === 0 || isOrderClosed}
            >
              {isOrderClosed ? "Order Closed" : "Send"}
            </Button>

            <p className="text-xs text-muted">
              {isOrderClosed
                ? "Done/paid has closed this order and table session."
                : hasConfirmedOrder
                  ? "New sends append items to the same kitchen ticket."
                  : "Send creates a kitchen ticket and starts the 30-minute due timer."}
            </p>

            {!isOrderClosed && hasConfirmedOrder && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleDonePaid}
                loading={closing}
              >
                Done/Paid And Close Table Session
              </Button>
            )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

