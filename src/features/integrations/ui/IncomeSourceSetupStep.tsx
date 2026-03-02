import Link from "next/link";
import type { IncomeProviderConnectionCard } from "@/features/integrations/shared";
import { IncomeProviderConnectCard } from "./IncomeProviderConnectCard";

export function IncomeSourceSetupStep({
  cards,
}: {
  cards: IncomeProviderConnectionCard[];
}) {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold text-foreground">Connect your income sources</h1>

      {cards.map((card) => (
        <IncomeProviderConnectCard key={card.provider.id} card={card} />
      ))}

      <div className="grid grid-cols-2 gap-3 pt-1">
        <Link
          href="/"
          className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/[0.04]"
        >
          Skip
        </Link>
        <Link
          href="/integrations"
          className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(0,127,255,0.28)] transition-colors hover:bg-primary-hover"
        >
          Continue
        </Link>
      </div>
    </div>
  );
}
