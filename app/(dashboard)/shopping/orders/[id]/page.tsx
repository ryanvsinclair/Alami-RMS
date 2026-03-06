"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import {
  getShoppingSession,
  reorderShoppingSession,
  scanAndReconcileReceipt,
} from "@/app/actions/modules/shopping";
import { uploadReceiptImageAction } from "@/app/actions/core/upload";
import { compressImage } from "@/shared/utils/compress-image";

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
  const [receiptScanning, setReceiptScanning] = useState(false);
  const [error, setError] = useState("");
  const receiptInputRef = useRef<HTMLInputElement>(null);

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

  async function handleReceiptScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    setReceiptScanning(true);
    setError("");
    try {
      const base64 = await compressImage(file, 1600, 1600, 0.8);
      const imageUrlPromise = uploadReceiptImageAction(base64, session.id).catch(() => null);
      await Promise.all([
        scanAndReconcileReceipt({
          session_id: session.id,
          base64_image: base64,
        }),
        imageUrlPromise,
      ]);
      const refreshed = await getShoppingSession(session.id);
      setSession(refreshed as SessionDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan receipt");
    } finally {
      setReceiptScanning(false);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
  }

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
      <main className="py-4 md:py-6">
        <DashboardPageContainer variant="standard">
          <div className="p-2 text-sm text-muted">Loading...</div>
        </DashboardPageContainer>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="py-4 md:py-6">
        <DashboardPageContainer variant="standard">
          <div className="p-2 text-sm text-danger">{error || "Order not found"}</div>
        </DashboardPageContainer>
      </main>
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
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="wide">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-4">
        {/* Store + Summary */}
        <Card className="p-5">
          <p className="text-xs text-muted normal-case tracking-normal">Store</p>
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

        {!session.receipt?.id && (
          <Card className="p-5">
            <p className="text-xs text-muted normal-case tracking-normal">Receipt Pending</p>
            <p className="mt-1 text-sm text-muted">
              This checkout was finalized without a receipt image. Scan the receipt now to resolve discrepancies.
            </p>
            <Button
              className="mt-4 w-full"
              onClick={() => receiptInputRef.current?.click()}
              loading={receiptScanning}
            >
              Scan Receipt
            </Button>
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleReceiptScan}
              className="hidden"
            />
          </Card>
        )}

        {/* Receipt Image */}
        {session.receipt?.image_url && (
          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted normal-case tracking-normal">Receipt</p>
              {session.receipt?.id && (
                <Link
                  href={`/receive/receipt/${session.receipt.id}`}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted hover:text-foreground transition-colors"
                >
                  View Photo
                </Link>
              )}
            </div>
            <img
              src={session.receipt.image_url}
              alt="Receipt"
              className="w-full rounded-xl"
            />
          </Card>
        )}

            {/* Re-order */}
            <Button className="w-full" size="lg" onClick={handleReorder} loading={reordering}>
              Re-order This Trip
            </Button>

            {error && <p className="text-sm text-danger">{error}</p>}
          </div>

          <div className="space-y-4">
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
          </div>
        </div>
      </DashboardPageContainer>
    </main>
  );
}
