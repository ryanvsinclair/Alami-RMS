"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getDraftInbox } from "@/app/actions/modules/documents";
import type { DocumentDraftStatus } from "@/features/documents/shared";

type InboxFilter = "default" | "all" | DocumentDraftStatus;

interface DraftSummary {
  id: string;
  status: DocumentDraftStatus;
  confidence_band: "high" | "medium" | "low" | "none" | null;
  parsed_vendor_name: string | null;
  parsed_total: number | null;
  parsed_date: string | null;
  auto_posted: boolean;
  created_at: string;
  vendor_profile: {
    id: string;
    vendor_name: string;
  } | null;
}

interface DraftInboxResult {
  page: number;
  pageSize: number;
  total: number;
  drafts: DraftSummary[];
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
  return parsed.toLocaleDateString();
}

function statusVariant(status: DocumentDraftStatus) {
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

function confidenceVariant(confidence: DraftSummary["confidence_band"]) {
  switch (confidence) {
    case "high":
      return "success";
    case "medium":
      return "info";
    case "low":
      return "warning";
    default:
      return "default";
  }
}

const FILTERS: Array<{ key: InboxFilter; label: string }> = [
  { key: "default", label: "Open" },
  { key: "all", label: "All" },
  { key: "pending_review", label: "Pending Review" },
  { key: "draft", label: "Draft" },
  { key: "posted", label: "Posted" },
  { key: "rejected", label: "Rejected" },
];

export function DocumentInboxClient() {
  const [filter, setFilter] = useState<InboxFilter>("default");
  const [data, setData] = useState<DraftInboxResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const statusFilter =
        filter === "default" ? undefined : filter;
      const response = await getDraftInbox({
        page: 1,
        pageSize: 50,
        statusFilter,
      });
      setData(response as DraftInboxResult);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load documents");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const drafts = data?.drafts ?? [];
  const title = useMemo(() => {
    if (filter === "default") return "Open Drafts";
    if (filter === "all") return "All Documents";
    return `Documents: ${filter.replace(/_/g, " ")}`;
  }, [filter]);

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--surface-card-shadow)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Documents</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          Review parsed documents and post verified expenses.
        </p>
        <p className="mt-2 text-xs uppercase tracking-wide text-muted">
          Total: <span className="text-foreground">{data?.total ?? 0}</span>
        </p>
      </section>

      <section className="flex flex-wrap gap-2">
        {FILTERS.map((entry) => {
          const active = filter === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setFilter(entry.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                active
                  ? "border-foreground text-foreground bg-foreground/5"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </section>

      {error ? (
        <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="h-28 animate-pulse rounded-2xl border border-border bg-card"
            />
          ))}
        </div>
      ) : null}

      {!loading && drafts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center">
          <p className="text-sm font-semibold text-foreground">No documents found</p>
          <p className="mt-1 text-sm text-muted">
            Incoming documents will appear here after parse completes.
          </p>
        </div>
      ) : null}

      {!loading && drafts.length > 0 ? (
        <div className="space-y-3">
          {drafts.map((draft) => (
            <Link
              key={draft.id}
              href={`/documents/${draft.id}`}
              className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {draft.parsed_vendor_name ?? draft.vendor_profile?.vendor_name ?? "Unknown Vendor"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {formatDate(draft.parsed_date ?? draft.created_at)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatMoney(draft.parsed_total)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={statusVariant(draft.status)}>
                    {draft.status.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant={confidenceVariant(draft.confidence_band)}>
                    {draft.confidence_band ?? "none"}
                  </Badge>
                  {draft.auto_posted ? <Badge variant="info">auto posted</Badge> : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default DocumentInboxClient;
