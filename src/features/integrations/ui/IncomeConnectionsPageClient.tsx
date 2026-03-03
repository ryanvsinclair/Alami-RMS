"use client";

import Image from "next/image";
import type { IncomeProviderConnectionCard } from "@/features/integrations/shared";
import type { IncomeProviderType } from "@/features/integrations/shared";
import {
  type CalendarProviderId,
  type CalendarProviderDefinition,
  type CalendarProviderStatus,
  type CalendarProviderType,
} from "@/features/schedule/shared";
import { IncomeProviderConnectCard } from "./IncomeProviderConnectCard";

const INCOME_GROUP_LABEL: Partial<Record<IncomeProviderType, string>> = {
  pos:      "Point of Sale",
  delivery: "Food Delivery",
  payment:  "Payments",
};

const INCOME_GROUP_ORDER: IncomeProviderType[] = [
  "pos",
  "delivery",
  "payment",
  "ecommerce",
  "accounting",
  "bank",
];

const CALENDAR_GROUP_LABEL: Record<CalendarProviderType, string> = {
  general_calendar: "Calender",
  booking_platform: "Booking",
  reservation_platform: "Reservations",
};

const CALENDAR_GROUP_ORDER: CalendarProviderType[] = [
  "general_calendar",
  "booking_platform",
  "reservation_platform",
];

const CALENDAR_STATUS_ORDER: Record<CalendarProviderStatus, number> = {
  active: 0,
  pilot: 1,
  planned: 2,
};

const CALENDAR_STATUS_LABEL: Record<CalendarProviderStatus, string> = {
  active: "Connect",
  pilot: "Pilot",
  planned: "Coming soon",
};

const CALENDAR_STATUS_STYLE: Record<CalendarProviderStatus, string> = {
  active: "text-success",
  pilot: "text-foreground",
  planned: "text-muted",
};

interface CalendarProviderImageConfig {
  src: string;
  scale: string;
}

const CALENDAR_PROVIDER_IMAGE: Partial<
  Record<CalendarProviderId, CalendarProviderImageConfig>
> = {
  google_calendar: { src: "/provider-pics/Google-G-Icon-2025.png", scale: "scale-100" },
  outlook_calendar: { src: "/provider-pics/Microsoft_Outlook-Logo.wine.png", scale: "scale-130" },
  apple_ics: { src: "/provider-pics/896340.jpg", scale: "scale-225" },
  square_appointments: { src: "/provider-pics/square.jpg", scale: "scale-125" },
  calendly: { src: "/provider-pics/calendly_logo-freelogovectors.net_.png", scale: "scale-125" },
  mindbody: { src: "/provider-pics/mindbody1.jpeg", scale: "scale-120" },
  fresha: { src: "/provider-pics/fresha1.jpeg", scale: "scale-135" },
  vagaro: { src: "/provider-pics/5127Y9PrPCL.png", scale: "scale-105" },
  opentable: { src: "/provider-pics/opentable.png", scale: "scale-110" },
  resy: { src: "/provider-pics/resy.png", scale: "scale-170" },
};

function groupIncomeCards(cards: IncomeProviderConnectionCard[]) {
  const map = new Map<IncomeProviderType, IncomeProviderConnectionCard[]>();
  for (const card of cards) {
    const type = card.provider.type;
    if (!map.has(type)) map.set(type, []);
    map.get(type)!.push(card);
  }
  return INCOME_GROUP_ORDER.filter((t) => map.has(t)).map((t) => ({
    type: t,
    label: INCOME_GROUP_LABEL[t] ?? t,
    cards: map.get(t)!,
  }));
}

function groupCalendarProviders(
  providers: readonly CalendarProviderDefinition[],
) {
  const map = new Map<
    CalendarProviderType,
    CalendarProviderDefinition[]
  >();

  for (const provider of providers) {
    const type = provider.type;
    if (!map.has(type)) map.set(type, []);
    map.get(type)!.push(provider);
  }

  for (const entries of map.values()) {
    entries.sort((left, right) => {
      const statusOrder =
        CALENDAR_STATUS_ORDER[left.status] -
        CALENDAR_STATUS_ORDER[right.status];
      if (statusOrder !== 0) return statusOrder;

      return left.name.localeCompare(right.name);
    });
  }

  return CALENDAR_GROUP_ORDER.filter((t) => map.has(t)).map((t) => ({
    type: t,
    label: CALENDAR_GROUP_LABEL[t],
    providers: map.get(t)!,
  }));
}

function getProviderInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function getCalendarProviderDisplayName(provider: CalendarProviderDefinition): string {
  switch (provider.id) {
    case "google_calendar":
      return "Google";
    case "outlook_calendar":
      return "Outlook";
    case "apple_ics":
      return "Apple";
    case "square_appointments":
      return "Square";
    default:
      return provider.name;
  }
}

function CalendarProviderRow({
  provider,
}: {
  provider: CalendarProviderDefinition;
}) {
  const displayName = getCalendarProviderDisplayName(provider);
  const initials = getProviderInitials(displayName);
  const imageConfig = CALENDAR_PROVIDER_IMAGE[provider.id];
  const statusLabel = CALENDAR_STATUS_LABEL[provider.status];
  const statusClass = CALENDAR_STATUS_STYLE[provider.status];

  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-foreground/[0.06] overflow-hidden text-sm font-bold text-foreground">
        {imageConfig ? (
          <Image
            src={imageConfig.src}
            alt={displayName}
            width={40}
            height={40}
            className={`h-full w-full object-contain ${imageConfig.scale}`}
          />
        ) : (
          initials
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {displayName}
        </p>
      </div>
      <span className={`text-sm font-medium ${statusClass}`}>{statusLabel}</span>
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
}

export default function IncomeConnectionsPageClient({
  cards,
  calendarProviders,
  feedback,
}: {
  cards: IncomeProviderConnectionCard[];
  calendarProviders: readonly CalendarProviderDefinition[];
  feedback?: {
    oauth?: string;
    provider?: string;
    oauth_error?: string;
    sync?: string;
    records?: string;
    sync_error?: string;
  };
}) {
  const incomeGroups = groupIncomeCards(cards);
  const calendarGroups = groupCalendarProviders(calendarProviders);

  return (
    <div className="space-y-4 p-4">
      {feedback?.oauth === "connected" && (
        <div className="rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">
          {feedback.provider ? `${feedback.provider} connected successfully.` : "Provider connected successfully."}
        </div>
      )}
      {feedback?.oauth_error && (
        <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {feedback.oauth_error}
        </div>
      )}
      {feedback?.sync === "success" && (
        <div className="rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">
          Manual sync completed{feedback.records ? ` (${feedback.records} records fetched)` : ""}.
        </div>
      )}
      {feedback?.sync_error && (
        <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {feedback.sync_error}
        </div>
      )}

      {incomeGroups.map((group) => (
        <div key={group.type} className="space-y-2">
          <p className="px-1 text-xs font-semibold normal-case tracking-normal text-muted">
            {group.label}
          </p>
          <div className="overflow-hidden rounded-3xl bg-card shadow-(--surface-card-shadow)">
            {group.cards.map((card, index) => (
              <div key={card.provider.id}>
                {index > 0 && <div className="mx-4 border-t border-border/40" />}
                <IncomeProviderConnectCard card={card} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {calendarGroups.length > 0 && (
        <div className="space-y-2 pt-1">
          {calendarGroups.map((group) => (
            <div key={group.type} className="space-y-2">
              <p className="px-1 text-[11px] font-semibold normal-case tracking-normal text-muted/80">
                {group.label}
              </p>
              <div className="overflow-hidden rounded-3xl bg-card shadow-(--surface-card-shadow)">
                {group.providers.map((provider, index) => (
                  <div key={provider.id}>
                    {index > 0 && <div className="mx-4 border-t border-border/40" />}
                    <CalendarProviderRow provider={provider} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
