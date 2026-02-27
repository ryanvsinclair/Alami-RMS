"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBusinessConfig, useTerm } from "@/lib/config/context";

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
  {
    href: "/integrations",
    label: "Integrations",
    exact: false,
    moduleId: "integrations",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 17.25h7.5M6.75 9.75h10.5v4.5H6.75v-4.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75v3m6-3v3m-6 10.5v3m6-3v3" />
      </svg>
    ),
  },
  // UI-01: Intake Hub nav entry — intent-first unified landing for Shopping + Receive.
  // Existing /shopping and /receive nav entries preserved during migration (UI-04 consolidates).
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
  {
    href: "/shopping",
    label: "Shopping",
    exact: false,
    moduleId: "shopping",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.085.837l.383 1.437m0 0L6.75 12h10.5l2.01-5.69a.75.75 0 0 0-.707-.997H5.104Zm1.146 6.69a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm10.5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
      </svg>
    ),
  },
];

export function BottomNav({ enabledModules }: { enabledModules?: string[] }) {
  const pathname = usePathname();
  const config = useBusinessConfig();
  const receiveLabel = useTerm("receive");
  const shoppingLabel = useTerm("shopping");
  const effectiveEnabledModules = enabledModules ?? config.enabledModules;
  const moduleSet = effectiveEnabledModules ? new Set(effectiveEnabledModules) : null;
  const visibleItems = navItems.filter(
    (item) => !item.moduleId || !moduleSet || moduleSet.has(item.moduleId)
  );

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
          const isActive = item.exact
            ? pathname === item.href
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
              {item.moduleId === "receipts"
                ? receiveLabel
                : item.moduleId === "shopping"
                  ? shoppingLabel
                  : item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
