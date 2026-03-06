import { Card } from "@/components/ui/card";
import Link from "next/link";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { AppLockPinCard } from "@/components/security/app-lock-pin-card";
import { HomeQuickActionsSetupCard } from "@/components/settings/home-quick-actions-setup-card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { signOutAction } from "@/app/actions/core/auth";
import { requireBusinessMembership } from "@/core/auth/tenant";

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getDisplayName(
  userMetadata: Record<string, unknown> | null | undefined,
  email: string | null | undefined,
) {
  const metadataName =
    (typeof userMetadata?.full_name === "string" && userMetadata.full_name.trim()) ||
    (typeof userMetadata?.name === "string" && userMetadata.name.trim()) ||
    (typeof userMetadata?.preferred_username === "string" &&
      userMetadata.preferred_username.trim()) ||
    "";

  if (metadataName) return metadataName;
  if (email) return email.split("@")[0];
  return "Member";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

export default async function SettingsPage() {
  const { business, membership, user } = await requireBusinessMembership();
  const metadata = (user.user_metadata ?? null) as Record<string, unknown> | null;
  const displayName = getDisplayName(metadata, user.email);
  const initials = getInitials(displayName);

  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="narrow">
        <div className="space-y-4">
          <div>
            <h1 className="text-[2rem] font-bold tracking-tight text-foreground">Settings</h1>
          </div>

          <Card className="p-2">
            <Link
              href="/profile"
              className="flex items-center gap-3 rounded-xl bg-foreground/[0.03] px-3 py-3 transition-colors hover:bg-foreground/[0.05]"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-foreground/[0.1] text-base font-semibold text-foreground">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted">
                  {user.email ?? `${toTitleCase(membership.role)} - ${business.name}`}
                </p>
              </div>
              <svg
                viewBox="0 0 20 20"
                className="h-5 w-5 text-muted"
                fill="none"
                aria-hidden="true"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M7 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </Card>

          <Card className="divide-y divide-border/40 overflow-hidden p-0">
            <Link
              href="/integrations"
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-foreground/[0.04]"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Integrations</p>
              </div>
              <svg
                viewBox="0 0 20 20"
                className="h-5 w-5 shrink-0 text-muted"
                fill="none"
                aria-hidden="true"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M7 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>

            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Theme Settings</p>
                <p className="text-xs text-muted">
                  Theme toggle coming soon. Light mode is currently default.
                </p>
              </div>
              <ThemeToggle />
            </div>

            <div className="px-4 py-3.5">
              <AppLockPinCard />
            </div>

            <div className="px-4 py-3.5">
              <HomeQuickActionsSetupCard />
            </div>
          </Card>

          <form action={signOutAction} className="flex justify-center pt-1">
            <button
              type="submit"
              className="rounded-full px-4 py-2 text-xs font-semibold text-muted transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              Logout
            </button>
          </form>
        </div>
      </DashboardPageContainer>
    </main>
  );
}
