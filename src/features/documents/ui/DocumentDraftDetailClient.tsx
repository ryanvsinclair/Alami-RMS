"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  blockVendor,
  confirmLineItemMapping,
  confirmVendorForDraft,
  createVendorProfile,
  disableAutoPost,
  getDraftDetail,
  getDraftDocumentUrl,
  postDraft,
  rejectDraft,
  updateVendorTrustThreshold,
} from "@/app/actions/modules/documents";
import { VendorMappingPanel } from "./VendorMappingPanel";

interface DraftLineItemView {
  description: string;
  quantity: number | null;
  unit_cost: number | null;
  line_total: number | null;
  mapped_inventory_item_id: string | null;
  mapped_inventory_item_name: string | null;
  mapping_confirmed_count: number | null;
}

interface DraftDetailView {
  id: string;
  status: "received" | "parsing" | "draft" | "pending_review" | "posted" | "rejected";
  raw_content_type: string;
  parsed_vendor_name: string | null;
  parsed_date: string | null;
  parsed_total: number | null;
  parsed_tax: number | null;
  confidence_score: number | null;
  confidence_band: "high" | "medium" | "low" | "none" | null;
  parse_flags: unknown;
  anomaly_flags: unknown;
  auto_posted: boolean;
  posted_at: string | null;
  financial_transaction_id: string | null;
  raw_document_preview_text: string | null;
  sender_email: string | null;
  vendor_profile: {
    id: string;
    vendor_name: string;
    trust_state: string;
    total_posted: number;
    trust_threshold_override: number | null;
    auto_post_enabled: boolean;
  } | null;
  vendor_profiles: Array<{
    id: string;
    vendor_name: string;
    trust_state: string;
    total_posted: number;
    trust_threshold_override: number | null;
  }>;
  inventory_items: Array<{
    id: string;
    name: string;
  }>;
  line_items: DraftLineItemView[];
  canManageTrustThreshold?: boolean;
}

function formatMoney(value: number | null | undefined) {
  const amount = value ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleString();
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function getEntityId(value: unknown) {
  if (!value || typeof value !== "object" || !("id" in value)) return null;
  const candidate = (value as { id?: unknown }).id;
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate
    : null;
}

function statusVariant(status: DraftDetailView["status"]) {
  switch (status) {
    case "posted":
      return "success";
    case "rejected":
      return "danger";
    case "pending_review":
      return "warning";
    case "draft":
      return "default";
    default:
      return "info";
  }
}

const ANOMALY_EXPLANATIONS: Record<string, string> = {
  large_total: "Total is unusually high for this vendor.",
  new_format: "Document format appears different from previous posts.",
  vendor_name_mismatch: "Parsed vendor does not match expected canonical vendor.",
  unusual_line_count: "Line-item count is outside normal vendor pattern.",
  duplicate_suspected: "Possible duplicate of a recently posted document.",
};

export function DocumentDraftDetailClient({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<DraftDetailView | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [draftDetail, signedUrl] = await Promise.all([
        getDraftDetail(draftId),
        getDraftDocumentUrl(draftId).catch(() => null),
      ]);
      setDetail((draftDetail as DraftDetailView | null) ?? null);
      setDocumentUrl((signedUrl as string | null) ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load document draft");
      setDetail(null);
      setDocumentUrl(null);
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const anomalyFlags = useMemo(
    () => toStringArray(detail?.anomaly_flags),
    [detail?.anomaly_flags],
  );

  async function runAction(action: () => Promise<void>) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await action();
      await reload();
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <div className="h-20 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-56 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4 p-4">
        <Link href="/documents" className="text-sm text-primary hover:underline">
          Back to Documents
        </Link>
        <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error || "Document draft not found"}
        </div>
      </div>
    );
  }

  const canPost =
    detail.status === "pending_review" || detail.status === "draft";
  const effectiveTrustThreshold =
    detail.vendor_profile?.trust_threshold_override ?? 5;
  const showPdfPreview =
    documentUrl != null && detail.raw_content_type.toLowerCase().includes("pdf");
  const showImagePreview =
    documentUrl != null && detail.raw_content_type.toLowerCase().startsWith("image/");

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Link href="/documents" className="text-sm text-primary hover:underline">
          Back to Documents
        </Link>
        <Badge variant={statusVariant(detail.status)}>
          {detail.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {error ? (
        <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Parsed Fields</p>
        <h1 className="text-xl font-bold text-foreground">
          {detail.parsed_vendor_name ?? detail.vendor_profile?.vendor_name ?? "Unknown Vendor"}
        </h1>
        <p className="text-sm text-muted">{formatDate(detail.parsed_date)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Total: {formatMoney(detail.parsed_total)}</Badge>
          <Badge variant="default">Tax: {formatMoney(detail.parsed_tax)}</Badge>
          <Badge variant="default">
            Confidence: {detail.confidence_band ?? "none"}
            {detail.confidence_score != null ? ` (${Math.round(detail.confidence_score * 100)}%)` : ""}
          </Badge>
          {detail.auto_posted ? <Badge variant="info">auto posted</Badge> : null}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Source Document</p>
        {showPdfPreview ? (
          <iframe
            title="Document Preview"
            src={documentUrl ?? undefined}
            className="h-96 w-full rounded-xl border border-border"
          />
        ) : null}
        {showImagePreview ? (
          <img
            src={documentUrl ?? ""}
            alt="Document Preview"
            className="max-h-96 w-full rounded-xl object-contain"
          />
        ) : null}
        {!showPdfPreview && !showImagePreview && detail.raw_document_preview_text ? (
          <pre className="max-h-96 overflow-auto rounded-xl border border-border bg-background p-3 text-xs text-foreground">
            {detail.raw_document_preview_text}
          </pre>
        ) : null}
        {!showPdfPreview && !showImagePreview && !detail.raw_document_preview_text && documentUrl ? (
          <a
            href={documentUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Open Source Document
          </a>
        ) : null}
      </section>

      <details className="rounded-2xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-primary">
          Parse Flags
        </summary>
        <pre className="mt-3 max-h-72 overflow-auto rounded-xl border border-border bg-background p-3 text-xs text-foreground">
          {JSON.stringify(detail.parse_flags ?? {}, null, 2)}
        </pre>
      </details>

      {anomalyFlags.length > 0 ? (
        <section className="space-y-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Anomaly Warnings
          </p>
          {anomalyFlags.map((flag) => (
            <p key={flag} className="text-sm text-amber-800">
              <span className="font-semibold">{flag}</span>
              {" - "}
              {ANOMALY_EXPLANATIONS[flag] ?? "Review this draft before posting."}
            </p>
          ))}
        </section>
      ) : null}

      <VendorMappingPanel
        parsedVendorName={detail.parsed_vendor_name}
        senderEmail={detail.sender_email}
        vendorProfiles={detail.vendor_profiles}
        parsedLineItems={detail.line_items.map((line) => ({ description: line.description }))}
        inventoryItems={detail.inventory_items}
        canManageTrustThreshold={detail.canManageTrustThreshold ?? false}
        onConfirmVendor={(vendorProfileId) =>
          runAction(async () => {
            await confirmVendorForDraft(draftId, vendorProfileId);
            setNotice("Vendor mapping updated.");
          })
        }
        onCreateVendor={(payload) =>
          runAction(async () => {
            const created = await createVendorProfile(payload);
            const createdId = getEntityId(created);
            if (!createdId) throw new Error("Vendor profile was created without an id");
            await confirmVendorForDraft(draftId, createdId);
            setNotice("Vendor created and mapped.");
          })
        }
        onUpdateTrustThreshold={(vendorProfileId, threshold) =>
          runAction(async () => {
            await updateVendorTrustThreshold(vendorProfileId, threshold);
            setNotice("Trust threshold updated.");
          })
        }
        onConfirmLineItemMapping={(vendorProfileId, rawName, inventoryItemId) =>
          runAction(async () => {
            await confirmLineItemMapping(vendorProfileId, rawName, inventoryItemId);
            setNotice("Line-item mapping saved.");
          })
        }
      />

      {detail.vendor_profile ? (
        <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Vendor Trust</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">state: {detail.vendor_profile.trust_state}</Badge>
            <Badge variant="default">posted: {detail.vendor_profile.total_posted}</Badge>
            <Badge variant="default">threshold: {effectiveTrustThreshold}</Badge>
            <Badge variant={detail.vendor_profile.auto_post_enabled ? "success" : "warning"}>
              auto-post {detail.vendor_profile.auto_post_enabled ? "enabled" : "disabled"}
            </Badge>
          </div>
          {detail.canManageTrustThreshold ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={!detail.vendor_profile.auto_post_enabled || saving}
                onClick={() =>
                  runAction(async () => {
                    await disableAutoPost(detail.vendor_profile!.id);
                    setNotice("Auto-post disabled for vendor.");
                  })
                }
              >
                Disable Auto-Post
              </Button>
              <Button
                variant="danger"
                disabled={saving}
                onClick={() =>
                  runAction(async () => {
                    await blockVendor(detail.vendor_profile!.id);
                    setNotice("Vendor blocked from auto-post.");
                  })
                }
              >
                Block Vendor
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Line Items</p>
        {detail.line_items.length === 0 ? (
          <p className="text-sm text-muted">No parsed line items.</p>
        ) : (
          <div className="space-y-2">
            {detail.line_items.map((lineItem) => (
              <div
                key={lineItem.description}
                className="grid gap-1 rounded-xl border border-border p-3 text-sm md:grid-cols-4"
              >
                <p className="font-medium text-foreground">{lineItem.description}</p>
                <p className="text-muted">
                  Qty: {lineItem.quantity ?? 1}
                </p>
                <p className="text-muted">
                  Unit: {formatMoney(lineItem.unit_cost)}
                </p>
                <p className="text-muted">
                  Mapped: {lineItem.mapped_inventory_item_name ?? "Unmapped"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            runAction(async () => {
              await postDraft(draftId);
              setNotice("Draft posted as document_intake expense.");
            })
          }
          loading={saving}
          disabled={!canPost}
        >
          Post Expense
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            runAction(async () => {
              await rejectDraft(draftId);
              setNotice("Draft rejected.");
            })
          }
          disabled={!canPost || saving}
        >
          Reject
        </Button>
      </section>

      {detail.status === "posted" ? (
        <p className="text-sm text-muted">
          Posted as document_intake expense on {formatDate(detail.posted_at)}.
          {detail.financial_transaction_id ? ` Financial transaction id: ${detail.financial_transaction_id}.` : ""}
        </p>
      ) : null}
    </div>
  );
}

export default DocumentDraftDetailClient;
