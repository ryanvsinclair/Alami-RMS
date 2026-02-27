import Link from "next/link";
import type { IndustryType } from "@/lib/generated/prisma/client";
import type { IncomeProviderConnectionCard } from "@/features/integrations/shared";
import { IncomeProviderConnectCard } from "./IncomeProviderConnectCard";

export function IncomeSourceSetupStep({
  cards,
  industryType,
}: {
  cards: IncomeProviderConnectionCard[];
  industryType: IndustryType;
}) {
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--surface-card-shadow)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step 1 of 1</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">Connect Your Income Sources</h1>
        <p className="mt-2 text-sm text-muted">
          These sources are optional. You can connect any combination now and add more later.
        </p>
        <p className="mt-2 text-xs uppercase tracking-wide text-muted">
          Business type: <span className="text-foreground">{industryType}</span>
        </p>
      </div>

      {cards.map((card) => (
        <IncomeProviderConnectCard key={card.provider.id} card={card} />
      ))}

      <div className="rounded-3xl border border-border bg-card p-4 text-sm text-muted">
        <p>Connections are not yet live in this phase.</p>
        <p className="mt-1">Provider OAuth and token storage are shipped in IN-02 and beyond.</p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/[0.04]"
        >
          Skip for now
        </Link>
        <Link
          href="/integrations"
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(0,127,255,0.28)] transition-colors hover:bg-primary-hover"
        >
          Continue to Integrations
        </Link>
      </div>
    </div>
  );
}
