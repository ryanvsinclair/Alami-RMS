"use client";

/**
 * Bottom navigation bar.
 *
 * Current nav order: Home | Staff | Intake | Documents (module-gated) | Inventory | Schedule
 *
 * - /intake highlights when user is anywhere in /intake, /shopping, or /receive.
 * - /shopping and /receive are full feature routes accessible via the Intake Hub.
 * - /integrations is accessible directly but not a primary nav slot.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBusinessConfig } from "@/lib/config/context";
import { useEffect, useMemo, useState } from "react";
import { getDraftInboxBadgeCount } from "@/app/actions/modules/documents";

// /intake highlights when user is inside any intake-family route.
const INTAKE_ACTIVE_PREFIXES = ["/intake", "/shopping", "/receive"];

type NavItem = {
  href: string;
  label: string;
  exact: boolean;
  moduleId?: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Home",
    exact: true,
    icon: (
      // App logo mark — two stacked chevrons, filled with currentColor to
      // match nav active (text-primary) / inactive (text-foreground/45) states.
      <svg className="w-6 h-6" viewBox="0 0 2212 1604" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path fillRule="evenodd" clipRule="evenodd" d="M1065.66 20.3398C1085.65 -6.77999 1126.19 -6.77988 1146.17 20.3398L2202 1453.24C2226.32 1486.26 2202.75 1532.9 2161.74 1532.9H1709.1C1707.87 1532.9 1706.78 1532.18 1706.02 1531.21L1130.98 788.195C1126.97 783.023 1119.16 783.023 1115.16 788.195L540.112 1531.21C539.358 1532.18 538.264 1532.9 537.032 1532.9H50.09C9.08263 1532.9 -14.4885 1486.26 9.83707 1453.24L1065.66 20.3398Z" />
        <path d="M1088.68 1038.22C1108.66 1011.12 1149.17 1011.12 1169.16 1038.22L1413.1 1368.98C1437.44 1401.99 1413.88 1448.66 1372.86 1448.66H884.973C843.956 1448.66 820.388 1401.99 844.734 1368.98L1088.68 1038.22Z" />
      </svg>
    ),
  },
  {
    href: "/staff",
    label: "Staff",
    exact: false,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  // Intake Hub — single nav entry for all inventory intake workflows.
  {
    href: "/intake",
    label: "Intake",
    exact: false,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    href: "/documents",
    label: "Documents",
    exact: false,
    moduleId: "documents",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-8.25A2.25 2.25 0 0 0 17.25 3.75H6.75A2.25 2.25 0 0 0 4.5 6v12A2.25 2.25 0 0 0 6.75 20.25h6.75M8.25 7.5h7.5M8.25 11.25h7.5M8.25 15h4.5m3.75 0h4.5m0 0-1.5-1.5m1.5 1.5-1.5 1.5" />
      </svg>
    ),
  },
  {
    href: "/inventory",
    label: "Inventory",
    exact: false,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
      </svg>
    ),
  },
  // Operational Calendar — aggregated schedule for all business event types.
  {
    href: "/schedule",
    label: "Schedule",
    exact: false,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
];

function formatBadgeCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

export function BottomNav({ enabledModules }: { enabledModules?: string[] }) {
  const pathname = usePathname();
  useBusinessConfig(); // keep context subscription for potential future capability gating
  const [documentsBadgeCount, setDocumentsBadgeCount] = useState<number | null>(null);

  const enabledModuleSet = useMemo(
    () => new Set(enabledModules ?? []),
    [enabledModules],
  );

  const visibleItems = useMemo(
    () =>
      navItems.filter((item) =>
        item.moduleId ? enabledModuleSet.has(item.moduleId) : true,
      ),
    [enabledModuleSet],
  );

  useEffect(() => {
    if (!enabledModuleSet.has("documents")) {
      return;
    }

    let active = true;
    getDraftInboxBadgeCount()
      .then((count) => {
        if (!active) return;
        const numericCount = typeof count === "number" ? count : Number(count ?? 0);
        setDocumentsBadgeCount(Number.isFinite(numericCount) ? numericCount : 0);
      })
      .catch(() => {
        if (!active) return;
        setDocumentsBadgeCount(0);
      });

    return () => {
      active = false;
    };
  }, [enabledModuleSet, pathname]);

  return (
    <nav className="fixed inset-x-0 bottom-4 z-50 px-3 pointer-events-none safe-bottom">
      <div
        className="pointer-events-auto mx-auto flex h-[72px] max-w-lg items-center justify-between gap-1 rounded-full px-2 py-1.5 text-foreground backdrop-blur-xl"
        style={{
          background: "var(--surface-nav-bg)",
          boxShadow: "var(--surface-nav-shadow)",
        }}
      >
        {visibleItems.map((item) => {
          // /intake highlights for all intake-family routes (shopping, receive, intake).
          const isActive = item.exact
            ? pathname === item.href
            : item.href === "/intake"
              ? INTAKE_ACTIVE_PREFIXES.some((p) => pathname.startsWith(p))
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex h-full min-h-[58px] w-full flex-col items-center justify-center gap-1 rounded-full px-2
                text-[10px] font-semibold tracking-wide transition-all duration-200 capitalize
                ${
                  isActive
                    ? "text-primary"
                    : "text-foreground/45 hover:text-foreground/70"
                }
              `}
            >
              <span className="relative inline-flex">
                {item.icon}
                {item.href === "/documents" && (documentsBadgeCount ?? 0) > 0 ? (
                  <span className="absolute -right-3 -top-2 inline-flex min-w-[18px] justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {formatBadgeCount(documentsBadgeCount ?? 0)}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
