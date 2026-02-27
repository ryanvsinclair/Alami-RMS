"use client";

/**
 * Bottom navigation bar.
 *
 * Final nav order (OC-01): Home | Staff | Intake | Inventory | Schedule
 *
 * - /intake highlights when user is anywhere in /intake, /shopping, or /receive.
 * - /shopping and /receive are full feature routes accessible via the Intake Hub.
 * - /integrations is accessible directly but not a primary nav slot.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBusinessConfig } from "@/lib/config/context";

// /intake highlights when user is inside any intake-family route.
const INTAKE_ACTIVE_PREFIXES = ["/intake", "/shopping", "/receive"];

type NavItem = {
  href: string;
  label: string;
  exact: boolean;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Home",
    exact: true,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    href: "/staff",
    label: "Staff",
    exact: false,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    href: "/inventory",
    label: "Inventory",
    exact: false,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function BottomNav({ enabledModules: _enabledModules }: { enabledModules?: string[] }) {
  const pathname = usePathname();
  useBusinessConfig(); // keep context subscription for potential future capability gating
  const visibleItems = navItems;

  return (
    <nav className="fixed inset-x-0 bottom-4 z-50 px-3 pointer-events-none safe-bottom">
      <div
        className="pointer-events-auto mx-auto flex h-[72px] max-w-lg items-center justify-between gap-1 rounded-[28px] px-2 py-1.5 text-foreground backdrop-blur-xl"
        style={{
          border: "1px solid var(--surface-nav-border)",
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
              style={
                isActive
                  ? {
                      background: "var(--surface-nav-active-bg)",
                      boxShadow: "var(--surface-nav-active-ring)",
                    }
                  : undefined
              }
              className={`
                flex h-full min-h-[58px] w-full flex-col items-center justify-center gap-1 rounded-[22px] px-2
                text-[10px] font-semibold tracking-wide transition-all duration-200 capitalize
                ${
                  isActive
                    ? "text-foreground"
                    : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                }
              `}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
