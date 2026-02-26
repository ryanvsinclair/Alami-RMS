import Link from "next/link";
import { acceptStaffInviteAction, getInviteByToken } from "@/app/actions/core/staff";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";
  const invite = token ? await getInviteByToken(token) : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Team invite</p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">Join team</h1>
      </div>

      <div className="app-sheet rounded-3xl p-5 ring-1 ring-primary/10">
        {!invite && (
          <p className="text-sm text-muted">This invite link is invalid.</p>
        )}

        {invite && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              You were invited to join{" "}
              <span className="font-semibold">{invite.business?.name ?? "this business"}</span>{" "}
              as <span className="font-semibold">{invite.role}</span>.
            </p>
            <p className="text-xs text-muted">Invite email: {invite.email}</p>

            {invite.status === "pending" ? (
              <form action={acceptStaffInviteAction}>
                <input type="hidden" name="token" value={token} />
                <button
                  type="submit"
                  className="h-12 w-full rounded-2xl bg-primary font-semibold text-white shadow-[0_8px_20px_rgba(0,127,255,0.32)] transition-colors hover:bg-primary-hover"
                >
                  Accept Invite
                </button>
              </form>
            ) : (
              <p className="text-sm text-muted">Invite status: {invite.status}</p>
            )}
          </div>
        )}
      </div>

      {params.error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
          {decodeURIComponent(params.error)}
        </p>
      )}

      <p className="text-sm text-muted">
        Need to sign in first?{" "}
        <Link
          className="font-semibold text-primary"
          href={`/auth/login?next=${encodeURIComponent(`/auth/accept-invite?token=${token}`)}`}
        >
          Go to login
        </Link>
      </p>
    </div>
  );
}
