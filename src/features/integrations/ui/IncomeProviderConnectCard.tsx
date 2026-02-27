import Link from "next/link";
import type { IncomeProviderConnectionCard } from "@/features/integrations/shared";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { ConnectionStatusBadge } from "./ConnectionStatusBadge";

function providerTypeLabel(type: IncomeProviderConnectionCard["provider"]["type"]) {
  switch (type) {
    case "pos":
      return "POS";
    case "delivery":
      return "Delivery";
    case "payment":
      return "Payment";
    case "ecommerce":
      return "Ecommerce";
    case "accounting":
      return "Accounting";
    case "bank":
      return "Bank";
    default:
      return "Provider";
  }
}

export function IncomeProviderConnectCard({
  card,
  showComingSoonNote = true,
}: {
  card: IncomeProviderConnectionCard;
  showComingSoonNote?: boolean;
}) {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-foreground">{card.provider.name}</p>
            <Badge variant="info">{providerTypeLabel(card.provider.type)}</Badge>
            {card.recommended ? (
              <Badge variant="success">Recommended</Badge>
            ) : (
              <Badge variant="default">Optional</Badge>
            )}
          </div>
          <p className="text-sm text-muted">
            Connect your {card.provider.name} account to sync income into dashboard layers.
          </p>
          {card.lastSyncAt && (
            <p className="text-xs text-muted">
              Last synced:{" "}
              <span className="text-foreground">
                {new Date(card.lastSyncAt).toLocaleString()}
              </span>
            </p>
          )}
        </div>
        <ConnectionStatusBadge status={card.status} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {card.connectEnabled && card.connectHref ? (
            <Link
              href={card.connectHref}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:border-foreground/20 hover:bg-foreground/[0.04]"
            >
              {card.connectLabel}
            </Link>
          ) : (
            <Button variant="secondary" disabled>
              {card.connectLabel}
            </Button>
          )}
          {card.syncEnabled && card.syncHref && (
            <Link
              href={card.syncHref}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(0,127,255,0.28)] transition-colors hover:bg-primary-hover"
            >
              Run Sync
            </Link>
          )}
        </div>
        {showComingSoonNote && !card.connectEnabled && (
          <p className="text-xs text-muted">Set provider OAuth env vars to activate this connector.</p>
        )}
      </div>
    </Card>
  );
}
