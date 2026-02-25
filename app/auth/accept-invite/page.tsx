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

      <div className="rounded-3xl border border-[rgba(128,164,202,0.24)] bg-[linear-gradient(150deg,rgba(20,42,67,0.72)_0%,rgba(14,30,50,0.7)_60%,rgba(10,22,39,0.8)_100%)] p-5">
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
                  className="h-12 w-full rounded-2xl bg-primary font-semibold text-white shadow-[0_8px_20px_rgba(6,193,103,0.35)]"
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
        <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
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
