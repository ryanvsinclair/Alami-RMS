"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/nav/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getShoppingSession,
  reorderShoppingSession,
} from "@/app/actions/shopping";

interface SessionItem {
  id: string;
  raw_name: string;
  quantity: number | string;
  unit: string;
  staged_unit_price: number | string | null;
  staged_line_total: number | string | null;
  receipt_unit_price: number | string | null;
  receipt_line_total: number | string | null;
  origin: "staged" | "receipt";
  reconciliation_status: string;
  resolution: string;
}

interface SessionDetail {
  id: string;
  store_name: string | null;
  store_address: string | null;
  status: string;
  completed_at: string | null;
  staged_subtotal: number | string | null;
  receipt_subtotal: number | string | null;
  receipt_total: number | string | null;
  tax_total: number | string | null;
  items: SessionItem[];
  receipt: {
    id: string;
    image_url: string | null;
    raw_text: string | null;
  } | null;
}

function formatMoney(value: number | string | null | undefined): string {
  const num = value == null ? 0 : Number(value) || 0;
  return `$${num.toFixed(2)}`;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await getShoppingSession(sessionId);
        setSession(data as SessionDetail);
      } catch {
        setError("Failed to load order details");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  async function handleReorder() {
    setReordering(true);
    setError("");
    try {
      await reorderShoppingSession(sessionId);
      router.push("/shopping");
    } catch {
      setError("Failed to re-order");
    } finally {
      setReordering(false);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Order Details" backHref="/shopping/orders" />
        <div className="p-6 text-sm text-muted">Loading...</div>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <PageHeader title="Order Details" backHref="/shopping/orders" />
        <div className="p-6 text-sm text-danger">{error || "Order not found"}</div>
      </>
    );
  }

  const itemTotal = session.items
    .filter((item) => item.resolution !== "skip")
    .reduce((sum, item) => {
      const receipt = Number(item.receipt_line_total) || 0;
      if (receipt > 0) return sum + receipt;
      return sum + (Number(item.staged_line_total) || 0);
    }, 0);

  return (
    <>
      <PageHeader title={session.store_name ?? "Order Details"} backHref="/shopping/orders" />
      <div className="p-4 space-y-4">
        {/* Store + Summary */}
        <Card className="p-5">
          <p className="text-xs text-muted uppercase tracking-wide">Store</p>
          <h2 className="text-xl font-bold">{session.store_name}</h2>
          {session.store_address && (
            <p className="text-xs text-muted mt-0.5">{session.store_address}</p>
          )}
          {session.completed_at && (
            <p className="text-xs text-muted mt-1">
              {new Date(session.completed_at).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div>
              <p className="text-xs text-muted">Subtotal</p>
              <p className="font-bold">{formatMoney(session.receipt_subtotal ?? session.staged_subtotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Tax</p>
              <p className="font-bold">{formatMoney(session.tax_total)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Total</p>
              <p className="font-bold">{formatMoney(session.receipt_total ?? itemTotal)}</p>
            </div>
          </div>
        </Card>

        {/* Receipt Image */}
        {session.receipt?.image_url && (
          <Card className="p-5">
            <p className="text-xs text-muted uppercase tracking-wide mb-2">Receipt</p>
            <img
              src={session.receipt.image_url}
              alt="Receipt"
              className="w-full rounded-xl"
            />
          </Card>
        )}

        {/* Items */}
        <p className="text-sm font-semibold">{session.items.length} Items</p>
        <div className="space-y-2">
          {session.items.map((item) => {
            const useReceipt =
              item.origin === "receipt" || item.resolution === "accept_receipt";
            const displayPrice = useReceipt
              ? item.receipt_unit_price
              : item.staged_unit_price;
            const displayTotal = useReceipt
              ? item.receipt_line_total
              : item.staged_line_total;

            return (
              <Card key={item.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.raw_name}</p>
                    <p className="text-xs text-muted">
                      {Number(item.quantity) || 1} {item.unit}
                      {displayPrice != null && ` @ ${formatMoney(displayPrice)}`}
                    </p>
                  </div>
                  <p className="font-bold shrink-0">{formatMoney(displayTotal)}</p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Re-order */}
        <Button className="w-full" size="lg" onClick={handleReorder} loading={reordering}>
          Re-order This Trip
        </Button>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </>
  );
}
