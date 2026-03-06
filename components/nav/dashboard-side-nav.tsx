"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";

type DashboardSideNavItem = {
  href: string;
  label: string;
  exact?: boolean;
  moduleId?: string;
  activePrefixes?: string[];
  icon: React.ReactNode;
};

const DASHBOARD_SIDE_NAV_ITEMS: DashboardSideNavItem[] = [
  {
    href: "/",
    label: "Home",
    exact: true,
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 2212 1604" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" clipRule="evenodd" d="M1065.66 20.3398C1085.65 -6.77999 1126.19 -6.77988 1146.17 20.3398L2202 1453.24C2226.32 1486.26 2202.75 1532.9 2161.74 1532.9H1709.1C1707.87 1532.9 1706.78 1532.18 1706.02 1531.21L1130.98 788.195C1126.97 783.023 1119.16 783.023 1115.16 788.195L540.112 1531.21C539.358 1532.18 538.264 1532.9 537.032 1532.9H50.09C9.08263 1532.9 -14.4885 1486.26 9.83707 1453.24L1065.66 20.3398Z" />
        <path d="M1088.68 1038.22C1108.66 1011.12 1149.17 1011.12 1169.16 1038.22L1413.1 1368.98C1437.44 1401.99 1413.88 1448.66 1372.86 1448.66H884.973C843.956 1448.66 820.388 1401.99 844.734 1368.98L1088.68 1038.22Z" />
      </svg>
    ),
  },
  {
    href: "/staff",
    label: "Staff",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    href: "/reports",
    label: "Reports",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.6} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 16.5v-6m5.25 6v-9m5.25 9v-3" />
      </svg>
    ),
  },
  {
    href: "/contacts",
    label: "Contacts",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.75 1.03 8.966 8.966 0 0 1-4.5 1.252c-1.33 0-2.59-.291-3.72-.811M12 6.75a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Zm-9.75 12a9.02 9.02 0 0 1 6.22-8.568m7.06 8.568A9.02 9.02 0 0 0 9.31 10.182" />
      </svg>
    ),
  },
  {
    href: "/intake",
    label: "Intake",
    activePrefixes: ["/intake", "/shopping", "/receive"],
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    href: "/documents",
    label: "Documents",
    moduleId: "documents",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-8.25A2.25 2.25 0 0 0 17.25 3.75H6.75A2.25 2.25 0 0 0 4.5 6v12A2.25 2.25 0 0 0 6.75 20.25h6.75M8.25 7.5h7.5M8.25 11.25h7.5M8.25 15h4.5m3.75 0h4.5m0 0-1.5-1.5m1.5 1.5-1.5 1.5" />
      </svg>
    ),
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
      </svg>
    ),
  },
  {
    href: "/schedule",
    label: "Schedule",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    href: "/service",
    label: "Service",
    moduleId: "table_service",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25h15M6 5.25v11.5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V5.25M9.75 10.5h4.5m-4.5 3h4.5" />
      </svg>
    ),
  },
];

const SIDEBAR_DIRECT_ROUTES = new Set<string>([
  "/",
  "/staff",
  "/reports",
  "/contacts",
  "/intake",
  "/documents",
  "/inventory",
  "/schedule",
  "/service",
  "/service/tables",
  "/settings",
]);

function cx(...classes: Array<string | false>) {
  return classes.filter(Boolean).join(" ");
}

function shouldShowContextReturn(pathname: string) {
  return !SIDEBAR_DIRECT_ROUTES.has(pathname);
}

function isItemActive(item: DashboardSideNavItem, pathname: string) {
  if (item.exact) return pathname === item.href;
  if (item.activePrefixes?.length) {
    return item.activePrefixes.some((prefix) => pathname.startsWith(prefix));
  }
  return pathname.startsWith(item.href);
}

export function DashboardSideNav({ enabledModules }: { enabledModules: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const enabledModuleSet = useMemo(() => new Set(enabledModules), [enabledModules]);
  const items = useMemo(
    () =>
      DASHBOARD_SIDE_NAV_ITEMS.filter((item) =>
        item.moduleId ? enabledModuleSet.has(item.moduleId) : true,
      ),
    [enabledModuleSet],
  );
  const showContextReturn = useMemo(
    () => shouldShowContextReturn(pathname),
    [pathname],
  );

  return (
    <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-20 md:flex-col md:gap-4 md:border-r md:border-border/60 md:bg-card/20 md:px-3 md:py-4 xl:w-64 xl:px-4 xl:py-6">
      <Link
        href="/"
        className="flex h-12 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-sm font-semibold text-foreground xl:justify-start xl:px-4"
      >
        <span className="xl:hidden">A</span>
        <span className="hidden xl:block">Alamir</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-2">
        {items.map((item) => {
          const isActive = isItemActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex min-h-11 items-center justify-center gap-3 rounded-xl px-2 text-xs font-semibold transition-colors xl:justify-start xl:px-3",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-foreground/65 hover:bg-foreground/[0.05] hover:text-foreground",
              )}
            >
              <span className="inline-flex shrink-0">{item.icon}</span>
              <span className="hidden xl:block">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {showContextReturn && (
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
              return;
            }
            router.push("/");
          }}
          className="flex min-h-11 items-center justify-center gap-3 rounded-xl px-2 text-xs font-semibold text-foreground/70 transition-colors hover:bg-foreground/[0.05] hover:text-foreground xl:justify-start xl:px-3"
          title="Return to previous page"
          aria-label="Return to previous page"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          <span className="hidden xl:block">Return</span>
        </button>
      )}

      <Link
        href="/settings"
        className={cx(
          "flex min-h-11 items-center justify-center gap-3 rounded-xl px-2 text-xs font-semibold transition-colors xl:justify-start xl:px-3",
          pathname.startsWith("/settings")
            ? "bg-primary/15 text-primary"
            : "text-foreground/65 hover:bg-foreground/[0.05] hover:text-foreground",
        )}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.5-3a7.5 7.5 0 0 1-.2 1.7l1.8 1.4-1.8 3.1-2.2-.8a7.5 7.5 0 0 1-2.9 1.7l-.4 2.3H10l-.4-2.3a7.5 7.5 0 0 1-2.9-1.7l-2.2.8-1.8-3.1 1.8-1.4a7.5 7.5 0 0 1 0-3.4L2.7 8.9l1.8-3.1 2.2.8a7.5 7.5 0 0 1 2.9-1.7L10 2.6h3.6l.4 2.3a7.5 7.5 0 0 1 2.9 1.7l2.2-.8 1.8 3.1-1.8 1.4c.1.6.2 1.1.2 1.7Z" />
        </svg>
        <span className="hidden xl:block">Settings</span>
      </Link>
    </aside>
  );
}
