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
        </div>
        <ConnectionStatusBadge status={card.status} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" disabled={!card.connectEnabled}>
          {card.connectLabel}
        </Button>
        {showComingSoonNote && !card.connectEnabled && (
          <p className="text-xs text-muted">OAuth activation starts in IN-02.</p>
        )}
      </div>
    </Card>
  );
}
