"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { IncomeProviderConnectionCard } from "@/features/integrations/shared";
import type {
  CalendarProviderDefinition,
  CalendarProviderId,
  CalendarProviderStatus,
} from "@/features/schedule/shared";
import { IncomeProviderConnectCard } from "./IncomeProviderConnectCard";

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

const EXIT_DURATION_MS = 240;

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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-foreground/[0.06] text-sm font-bold text-foreground">
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
      <p className="flex-1 truncate text-sm font-semibold text-foreground">
        {displayName}
      </p>
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

export function OnboardingConnectionsStep({
  title,
  incomeCards,
  calendarProviders,
  emptyStateText,
  backHref,
  skipHref,
  continueHref,
}: {
  title: string;
  incomeCards?: IncomeProviderConnectionCard[];
  calendarProviders?: readonly CalendarProviderDefinition[];
  emptyStateText?: string;
  backHref?: string;
  skipHref: string;
  continueHref: string;
}) {
  const router = useRouter();
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState<"forward" | "back">("forward");
  const incomes = incomeCards ?? [];
  const calendars = calendarProviders ?? [];
  const hasContent = incomes.length > 0 || calendars.length > 0;
  const animationClass = exiting
    ? exitDirection === "back"
      ? "translate-x-8 opacity-0"
      : "-translate-x-8 opacity-0"
    : entered
      ? "translate-x-0 opacity-100"
      : "translate-x-8 opacity-0";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function navigateTo(href: string, direction: "forward" | "back" = "forward") {
    if (exiting) return;
    setExitDirection(direction);
    setExiting(true);
    window.setTimeout(() => {
      router.push(href);
    }, EXIT_DURATION_MS);
  }

  function navigateBack() {
    if (exiting) return;
    if (backHref) {
      navigateTo(backHref, "back");
      return;
    }
    setExitDirection("back");
    setExiting(true);
    window.setTimeout(() => {
      router.back();
    }, EXIT_DURATION_MS);
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div
        className={`mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-32 pt-[calc(env(safe-area-inset-top)+40px)] transition-all duration-300 ease-out ${animationClass}`}
      >
        <button
          type="button"
          onClick={navigateBack}
          disabled={exiting}
          aria-label="Go back"
          className="absolute left-4 top-[calc(env(safe-area-inset-top)+10px)] inline-flex h-10 w-10 items-center justify-center rounded-full bg-card/70 text-foreground backdrop-blur transition-colors hover:bg-card disabled:pointer-events-none disabled:opacity-70"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <h1 className="px-1 pt-10 text-2xl font-bold text-foreground">{title}</h1>

        <div className="flex min-h-0 flex-1 flex-col justify-center py-4">
          <div className="mx-auto w-full max-w-md space-y-3">
            {incomes.length > 0 && (
              <div className="overflow-hidden rounded-3xl bg-card shadow-(--surface-card-shadow)">
                {incomes.map((card, index) => (
                  <div key={card.provider.id}>
                    {index > 0 && <div className="mx-4 border-t border-border/40" />}
                    <IncomeProviderConnectCard card={card} />
                  </div>
                ))}
              </div>
            )}

            {calendars.length > 0 && (
              <div className="overflow-hidden rounded-3xl bg-card shadow-(--surface-card-shadow)">
                {calendars.map((provider, index) => (
                  <div key={provider.id}>
                    {index > 0 && <div className="mx-4 border-t border-border/40" />}
                    <CalendarProviderRow provider={provider} />
                  </div>
                ))}
              </div>
            )}

            {!hasContent && (
              <div className="rounded-3xl bg-card p-4 text-sm text-muted shadow-(--surface-card-shadow)">
                {emptyStateText ?? "No providers available in this category yet."}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-background via-background/90 to-transparent" />

      <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        <div className="mx-auto grid w-full max-w-lg grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigateTo(skipHref, "forward")}
            disabled={exiting}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/[0.04] disabled:pointer-events-none disabled:opacity-70"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => navigateTo(continueHref, "forward")}
            disabled={exiting}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(0,127,255,0.28)] transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-70"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
