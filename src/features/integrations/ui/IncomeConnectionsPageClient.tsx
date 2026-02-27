"use client";

import type { IndustryType } from "@/lib/generated/prisma/client";
import type { IncomeProviderConnectionCard } from "@/features/integrations/shared";
import { IncomeProviderConnectCard } from "./IncomeProviderConnectCard";

export default function IncomeConnectionsPageClient({
  cards,
  industryType,
}: {
  cards: IncomeProviderConnectionCard[];
  industryType: IndustryType;
}) {
  return (
    <div className="space-y-4 p-4">
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
