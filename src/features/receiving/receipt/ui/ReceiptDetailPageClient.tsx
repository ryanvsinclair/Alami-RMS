"use client";

import { startTransition, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getReceiptDetail } from "@/app/actions/modules/receipts";
import {
  DigitalReceipt,
  extractReceiptTotals,
} from "@/shared/components/receipts/digital-receipt";
import type { ReceiveReceiptDetail } from "@/features/receiving/shared/contracts";

type Tab = "digital" | "photo";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.07] ${className}`} />;
}

export default function ReceiptDetailPageClient() {
  const params = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<ReceiveReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("digital");

  useEffect(() => {
    if (!params.id) return;
    startTransition(() => {
      setLoading(true);
      setError("");
    });
    getReceiptDetail(params.id)
      .then((data) => {
        if (!data) {
          setError("Receipt not found");
          return;
        }
        setReceipt(data as ReceiveReceiptDetail);
        if ((data as ReceiveReceiptDetail).signed_image_url) {
          setTab("photo");
        }
      })
      .catch(() => setError("Failed to load receipt"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const totals = receipt
    ? extractReceiptTotals(receipt.raw_text, receipt.parsed_data)
    : null;
  const preferredStoreName =
    receipt?.shopping_session?.store_name ??
    receipt?.supplier?.name ??
    totals?.storeName ??
    null;

  const hasPhoto = Boolean(receipt?.signed_image_url);
  const hasLineItems = (receipt?.line_items.length ?? 0) > 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/60 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white truncate">
            {preferredStoreName || "Receipt"}
          </h1>
          {totals?.date && (
            <p className="text-xs text-white/40">{totals.date}</p>
          )}
          {!totals?.date && receipt?.created_at && (
            <p className="text-xs text-white/40">
              {new Date(receipt.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && receipt && (
        <>
          {hasPhoto && hasLineItems && (
            <div className="flex rounded-xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setTab("digital")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                  tab === "digital"
                    ? "bg-primary text-white"
                    : "text-white/50 hover:bg-white/5"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                Digital
              </button>
              <button
                onClick={() => setTab("photo")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                  tab === "photo"
                    ? "bg-primary text-white"
                    : "text-white/50 hover:bg-white/5"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                </svg>
                Photo
              </button>
            </div>
          )}

          {tab === "digital" && hasLineItems && (
            <DigitalReceipt
              storeName={preferredStoreName}
              date={totals?.date ?? null}
              lineItems={receipt.line_items}
              subtotal={totals?.subtotal ?? null}
              tax={totals?.tax ?? null}
              total={totals?.total ?? null}
              currency={totals?.currency ?? undefined}
              paymentMethod={totals?.paymentMethod}
            />
          )}

          {tab === "photo" && receipt.signed_image_url && (
            <div className="rounded-2xl overflow-hidden border border-white/8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receipt.signed_image_url}
                alt="Original receipt photo"
                className="w-full h-auto"
              />
            </div>
          )}

          {!hasPhoto && !hasLineItems && (
            <div className="text-center py-12">
              <p className="text-sm text-white/30">No receipt data available</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 pt-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                receipt.status === "committed"
                  ? "bg-success/15 text-success"
                  : receipt.status === "review"
                    ? "bg-amber-500/15 text-amber-400"
                    : receipt.status === "failed"
                      ? "bg-red-500/15 text-red-400"
                      : "bg-white/10 text-white/40"
              }`}
            >
              {receipt.status === "committed" && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
              {receipt.status}
            </span>
            <span className="text-[11px] text-white/20">
              {receipt.line_items.length} item{receipt.line_items.length !== 1 ? "s" : ""}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
