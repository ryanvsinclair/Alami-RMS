"use client";

import type { IndustryType } from "@/lib/generated/prisma/client";
import type { IncomeProviderConnectionCard } from "@/features/integrations/shared";
import { IncomeProviderConnectCard } from "./IncomeProviderConnectCard";

export default function IncomeConnectionsPageClient({
  cards,
  industryType,
  feedback,
}: {
  cards: IncomeProviderConnectionCard[];
  industryType: IndustryType;
  feedback?: {
    oauth?: string;
    provider?: string;
    oauth_error?: string;
    sync?: string;
    records?: string;
    sync_error?: string;
  };
}) {
  return (
    <div className="space-y-4 p-4">
      {feedback?.oauth === "connected" && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          {feedback.provider ? `${feedback.provider} connected successfully.` : "Provider connected successfully."}
        </div>
      )}
      {feedback?.oauth_error && (
        <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {feedback.oauth_error}
        </div>
      )}
      {feedback?.sync === "success" && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          Manual sync completed{feedback.records ? ` (${feedback.records} records fetched)` : ""}.
        </div>
      )}
      {feedback?.sync_error && (
        <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {feedback.sync_error}
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--surface-card-shadow)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Integrations</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">Income Connections</h1>
        <p className="mt-2 text-sm text-muted">
          Manage revenue providers for your business type and track connection status.
        </p>
        <p className="mt-2 text-xs uppercase tracking-wide text-muted">
          Business type: <span className="text-foreground">{industryType}</span>
        </p>
      </div>

      {cards.map((card) => (
        <IncomeProviderConnectCard key={card.provider.id} card={card} />
      ))}
    </div>
  );
}
