import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { signOutAction } from "@/app/actions/core/auth";
import { requireBusinessMembership } from "@/core/auth/tenant";
import { getTerminology } from "@/lib/config/terminology";

export default async function ProfilePage() {
  const { business, membership, user } = await requireBusinessMembership();
  const terms = getTerminology(business.industry_type);

  return (
    <div className="p-4 space-y-4">
      <Card className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Profile</p>
        <h1 className="mt-1 text-xl font-bold text-foreground">Profile</h1>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">{terms.business}</span>
            <span className="font-semibold text-foreground text-right">{business.name}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Role</span>
            <span className="capitalize">{membership.role}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Email</span>
            <span className="text-right">{user.email ?? "-"}</span>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Session</p>
        <p className="mt-2 text-sm text-muted">Manage your current session.</p>
        <form action={signOutAction} className="mt-4">
          <Button type="submit" variant="secondary" className="w-full">
            Logout
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Appearance</p>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Color mode</p>
            <p className="mt-1 text-xs text-muted">Switch between dark and light themes.</p>
          </div>
          <ThemeToggle />
        </div>
      </Card>
    </div>
  );
}
