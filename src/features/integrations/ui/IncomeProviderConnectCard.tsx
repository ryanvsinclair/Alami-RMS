import Image from "next/image";
import Link from "next/link";
import type { IncomeConnectionStatus, IncomeProviderConnectionCard, IncomeProviderId } from "@/features/integrations/shared";

interface ProviderImageConfig {
  src: string;
  /** Tailwind scale class, e.g. "scale-75", "scale-90", "scale-100", "scale-110" */
  scale: string;
}

const PROVIDER_IMAGE: Partial<Record<IncomeProviderId, ProviderImageConfig>> = {
  godaddy_pos:     { src: "/provider-pics/godaddy-logo-the-go.png",                           scale: "scale-75" },
  uber_eats:       { src: "/provider-pics/uber-eats-logo-39748746B7-seeklogo.com.png",         scale: "scale-125" },
  doordash:        { src: "/provider-pics/1656222751doordash-app-logo.png",                    scale: "scale-100" },
  square:          { src: "/provider-pics/square.jpg",                    scale: "scale-125" },
  stripe:          { src: "/provider-pics/stripe.jpg",                                         scale: "scale-200" },
  toast:           { src: "/provider-pics/toast.png",                                          scale: "scale-100" },
  skip_the_dishes: { src: "/provider-pics/skipthedishes.png",                                  scale: "scale-100" },
};

const statusLabel: Record<IncomeConnectionStatus, string> = {
  not_connected: "Connect",
  connected: "Connected",
  error: "Error",
};

const statusStyle: Record<IncomeConnectionStatus, string> = {
  not_connected: "text-muted",
  connected: "text-success",
  error: "text-danger",
};

export function IncomeProviderConnectCard({
  card,
}: {
  card: IncomeProviderConnectionCard;
  showComingSoonNote?: boolean;
}) {
  const imageConfig = PROVIDER_IMAGE[card.provider.id];
  const initial = card.provider.name.charAt(0).toUpperCase();
  const href = card.connectEnabled && card.connectHref ? card.connectHref : null;

  const inner = (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-foreground/[0.06] overflow-hidden text-sm font-bold text-foreground">
        {imageConfig ? (
          <Image
            src={imageConfig.src}
            alt={card.provider.name}
            width={40}
            height={40}
            className={`h-full w-full object-contain ${imageConfig.scale}`}
          />
        ) : (
          initial
        )}
      </div>
      <p className="flex-1 text-sm font-semibold text-foreground">{card.provider.name}</p>
      <span className={`text-sm font-medium ${statusStyle[card.status]}`}>
        {statusLabel[card.status]}
      </span>
      <svg
        className="h-4 w-4 shrink-0 text-muted/60"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2.5}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block transition-colors hover:bg-foreground/[0.03] active:bg-foreground/[0.05]"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="cursor-default opacity-60">
      {inner}
    </div>
  );
}
