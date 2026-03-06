import { Card } from "@/components/ui/card";
import Link from "next/link";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { requireBusinessMembership } from "@/core/auth/tenant";
import { getTerminology } from "@/lib/config/terminology";

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

export default async function ProfilePage() {
  const { business, membership, user } = await requireBusinessMembership();
  const terms = getTerminology(business.industry_type);
  const metadata = (user.user_metadata ?? null) as Record<string, unknown> | null;
  const displayName = getDisplayName(metadata, user.email);
  const initials = getInitials(displayName);

  return (
    <main className="py-4 md:py-6">
      <DashboardPageContainer variant="narrow">
        <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            aria-label="Back to settings"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-foreground/[0.03] text-foreground/80 transition-colors hover:bg-foreground/[0.07]"
          >
            <svg
              viewBox="0 0 20 20"
              className="h-5 w-5"
              fill="none"
              aria-hidden="true"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M12 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="text-[2rem] font-bold tracking-tight text-foreground">Profile</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
          <Card className="p-2">
            <div className="flex items-center gap-3 rounded-xl bg-foreground/[0.03] px-3 py-3 md:flex-col md:items-start">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-foreground/[0.1] text-base font-semibold text-foreground">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted">{user.email ?? "-"}</p>
              </div>
            </div>
          </Card>

          <Card className="divide-y divide-border/40 overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="text-muted">{terms.business}</span>
              <span className="max-w-[60%] truncate text-right font-medium text-foreground">
                {business.name}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="text-muted">Role</span>
              <span className="font-medium text-foreground">{toTitleCase(membership.role)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="text-muted">Email</span>
              <span className="max-w-[60%] truncate text-right text-foreground">{user.email ?? "-"}</span>
            </div>
          </Card>
        </div>
        </div>
      </DashboardPageContainer>
    </main>
  );
}
