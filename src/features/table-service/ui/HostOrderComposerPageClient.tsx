"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  appendKitchenOrderItems,
  closeKitchenOrderAndSession,
  confirmKitchenOrder,
} from "@/app/actions/modules/table-service";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import type {
  TableServiceDiningTableSummary,
  TableServiceKitchenOrderSummary,
  TableServiceMenuCategorySummary,
  TableServiceMenuItemSummary,
  TableServiceSessionSummary,
} from "@/features/table-service/shared";
import { ExitServiceModeButton } from "./ExitServiceModeButton";

type DraftLineItem = {
  id: string;
  menuItemId: string;
  quantity: string;
  notes: string;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

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

function formatDateTimeLabel(value: string | null) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleString();
}

interface HostOrderComposerPageClientProps {
  table: TableServiceDiningTableSummary;
  session: TableServiceSessionSummary;
  kitchenOrder: TableServiceKitchenOrderSummary | null;
  categories: TableServiceMenuCategorySummary[];
  items: TableServiceMenuItemSummary[];
}

export default function HostOrderComposerPageClient({
  table,
  session,
  kitchenOrder,
  categories,
  items,
}: HostOrderComposerPageClientProps) {
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
  const [draftItems, setDraftItems] = useState<DraftLineItem[]>([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState<TableServiceKitchenOrderSummary | null>(
    kitchenOrder,
  );

  const categoryById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category.name]));
  }, [categories]);

  const itemsById = useMemo(() => {
    return new Map(items.map((item) => [item.id, item]));
  }, [items]);

  const itemOptions = useMemo(() => {
    const categorySortOrderById = new Map(categories.map((category) => [category.id, category.sortOrder]));
    return [...items]
      .sort((a, b) => {
        const aCategorySort = a.categoryId ? (categorySortOrderById.get(a.categoryId) ?? 0) : Number.MAX_SAFE_INTEGER;
        const bCategorySort = b.categoryId ? (categorySortOrderById.get(b.categoryId) ?? 0) : Number.MAX_SAFE_INTEGER;
        if (aCategorySort !== bCategorySort) return aCategorySort - bCategorySort;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      })
      .map((item) => {
        const categoryName = item.categoryId ? (categoryById.get(item.categoryId) ?? "No category") : "No category";
        const priceText = moneyFormatter.format(toPriceNumber(item.price));
        return {
          value: item.id,
          label: `${item.name} | ${categoryName} | ${priceText}`,
        };
      });
  }, [categories, categoryById, items]);

  const summary = useMemo(() => {
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

  function handleAddLine() {
    setError("");
    setSuccess("");
    if (isOrderClosed) {
      setError("Order is already closed.");
      return;
    }
    if (!selectedMenuItemId) {
      setError("Select a menu item first.");
      return;
    }
    if (!itemsById.has(selectedMenuItemId)) {
      setError("Selected menu item is unavailable.");
      return;
    }

    setDraftItems((previous) => [
      ...previous,
      {
        id: makeDraftId(),
        menuItemId: selectedMenuItemId,
        quantity: "1",
        notes: "",
      },
    ]);
    setSelectedMenuItemId("");
  }

  function updateLine(
    lineId: string,
    updates: Partial<Pick<DraftLineItem, "menuItemId" | "quantity" | "notes">>,
  ) {
    setDraftItems((previous) =>
      previous.map((line) => {
        if (line.id !== lineId) return line;
        return { ...line, ...updates };
      }),
    );
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
      setError(
        hasConfirmedOrder
          ? "Add at least one order line before appending."
          : "Add at least one order line before confirming.",
      );
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
          ? "Items appended to existing kitchen ticket."
          : "Kitchen ticket created and visible to kitchen workflow.",
      );
    } catch {
      setError(
        hasConfirmedOrder
          ? "Failed to append items to kitchen ticket."
          : "Failed to create kitchen ticket.",
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
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-muted">Host Workspace</p>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <Link href="/service/menu" className="text-primary hover:underline">
                Menu Setup
              </Link>
              <Link href="/service/tables" className="text-primary hover:underline">
                Table Setup
              </Link>
              <Link href="/service/kitchen" className="text-primary hover:underline">
                Kitchen Queue
              </Link>
            </div>
            <ExitServiceModeButton />
          </div>
        </div>
        <h1 className="mt-1 text-xl font-bold text-foreground">{table.tableNumber}</h1>
        <p className="mt-2 text-sm text-muted">Active session: {session.id}</p>
      </Card>

      {success && (
        <div className="rounded-2xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {hasConfirmedOrder && confirmedOrder && (
        <Card className="p-5 space-y-3">
          <p className="text-sm font-semibold">Kitchen Ticket Created</p>
          <div className="rounded-2xl border border-border bg-foreground/[0.03] px-4 py-3 text-sm text-muted space-y-1">
            <p className="font-semibold text-foreground">Ticket ID: {confirmedOrder.id}</p>
            <p>Item lines: {confirmedOrder.items.length}</p>
            <p>Order notes: {confirmedOrder.notes ?? "None"}</p>
            <p>Confirmed at: {formatDateTimeLabel(confirmedOrder.confirmedAt)}</p>
            <p>Due at: {formatDateTimeLabel(confirmedOrder.dueAt)}</p>
            <p>Closed at: {formatDateTimeLabel(confirmedOrder.closedAt)}</p>
          </div>
          <div className="rounded-2xl border border-border px-4 py-3 text-sm text-muted space-y-1">
            {confirmedOrder.items.slice(-6).map((item) => {
              const itemName = itemsById.get(item.menuItemId)?.name ?? `Item ${item.menuItemId}`;
              return (
                <p key={item.id}>
                  {itemName} x{item.quantity} ({item.status})
                </p>
              );
            })}
            {confirmedOrder.items.length > 6 && (
              <p>...and {confirmedOrder.items.length - 6} more line(s).</p>
            )}
          </div>
          <p className="text-xs text-muted">
            {isOrderClosed
              ? "Order is closed. Start a new table session for additional orders."
              : "Post-confirm edits append new lines to this same ticket in `RTS-03-d`."}
          </p>
          {!isOrderClosed && (
            <Button
              onClick={handleDonePaid}
              loading={closing}
              className="w-full"
            >
              Done/Paid And Close Table Session
            </Button>
          )}
        </Card>
      )}

      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">Add Order Item</p>
        {itemOptions.length === 0 ? (
          <p className="text-sm text-muted">
            No available menu items yet. Add menu items in{" "}
            <Link href="/service/menu" className="text-primary hover:underline">
              Menu Setup
            </Link>
            .
          </p>
        ) : (
          <>
            <Select
              label="Menu item"
              options={itemOptions}
              value={selectedMenuItemId}
              placeholder="Choose menu item"
              onChange={(event) => setSelectedMenuItemId(event.target.value)}
              disabled={isOrderClosed}
            />
            <Button onClick={handleAddLine} disabled={!selectedMenuItemId || isOrderClosed}>
              Add Item Line
            </Button>
          </>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">Order Lines ({draftItems.length})</p>
        {draftItems.length === 0 ? (
          <p className="text-sm text-muted">No order lines yet.</p>
        ) : (
          draftItems.map((line, index) => {
            const menuItem = itemsById.get(line.menuItemId);
            if (!menuItem) {
              return null;
            }

            const quantity = toQuantity(line.quantity);
            const categoryName = menuItem.categoryId
              ? (categoryById.get(menuItem.categoryId) ?? "No category")
              : "No category";
            const unitPrice = toPriceNumber(menuItem.price);
            const lineTotal = unitPrice * quantity;

            return (
              <div key={line.id} className="rounded-2xl border border-border p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {index + 1}. {menuItem.name}
                    </p>
                    <p className="text-xs text-muted">
                      {categoryName} | {moneyFormatter.format(unitPrice)} each
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {moneyFormatter.format(lineTotal)}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[110px_1fr_auto] sm:items-end">
                  <Input
                    id={`${line.id}-qty`}
                    label="Qty"
                    type="number"
                    min={1}
                    step={1}
                    value={line.quantity}
                    onChange={(event) =>
                      updateLine(line.id, {
                        quantity: event.target.value,
                      })
                    }
                    disabled={isOrderClosed}
                  />
                  <Input
                    id={`${line.id}-notes`}
                    label="Notes"
                    placeholder="No onions"
                    value={line.notes}
                    onChange={(event) => updateLine(line.id, { notes: event.target.value })}
                    disabled={isOrderClosed}
                  />
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => removeLine(line.id)}
                    disabled={isOrderClosed}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">Order Summary</p>
        <div className="rounded-2xl border border-border bg-foreground/[0.03] px-4 py-3 text-sm text-muted space-y-1">
          <p>Line items: {summary.lineCount}</p>
          <p>Total quantity: {summary.totalQuantity}</p>
          <p className="font-semibold text-foreground">Subtotal: {moneyFormatter.format(summary.subtotal)}</p>
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
          {isOrderClosed
            ? "Order Closed"
            : hasConfirmedOrder
              ? "Append Items To Order"
              : "Confirm Order"}
        </Button>
        <p className="text-xs text-muted">
          {isOrderClosed
            ? "Done/paid has closed this order and table session."
            : hasConfirmedOrder
              ? "Post-confirm edits append new item rows to the same kitchen order."
              : "Confirm creates a kitchen ticket immediately and starts the 30-minute due timer."}
        </p>
      </Card>
    </div>
  );
}
